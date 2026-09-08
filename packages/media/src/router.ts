import { contentHash, failAfterPayment, markConfirmed, markMediaUploaded, markMetadataUploaded, markPaid, mintEnabled, newJob, quoteUpload, x402PaymentRequired } from './jobs';
import { createMockFacilitator, requirementFromQuote, type Facilitator } from './x402';
import { createSimulatedArweave, metadataObject, type ArweaveAdapter } from './arweave';
import { createMemoryMediaStore, type MediaStore } from './store';
import type { FileQuoteInput, UploadJob } from './types';

type MediaRequest = {
  method: string;
  pathname: string;
  headers: Record<string, string | undefined>;
  body: unknown;
  payer?: string;
};

type MediaResponse = { status: number; body: unknown };

const quotes = new Map<string, ReturnType<typeof quoteUpload>>();

function json(status: number, body: unknown): MediaResponse {
  return { status, body };
}

function record(body: unknown) {
  return body && typeof body === 'object' ? body as Record<string, unknown> : {};
}

export function createMediaRouter(options: {
  store?: MediaStore;
  facilitator?: Facilitator;
  arweave?: ArweaveAdapter;
  payTo: string;
  allowMockPayment?: boolean;
  network?: string;
  asset?: string;
}) {
  const store = options.store ?? createMemoryMediaStore();
  const facilitator = options.facilitator ?? createMockFacilitator();
  const arweave = options.arweave ?? createSimulatedArweave();

  return {
    store,
    async handle(req: MediaRequest): Promise<MediaResponse> {
      const path = req.pathname.replace(/\/$/, '') || '/';
      const method = req.method.toUpperCase();
      const payer = req.payer?.toLowerCase();

      if (path === '/quote' && method === 'POST') {
        const body = record(req.body);
        const files = (body.files as FileQuoteInput[] | undefined) ?? [];
        try {
          const quote = quoteUpload({
            files,
            payTo: options.payTo,
            network: options.network,
            asset: options.asset,
            idempotencyKey: body.idempotencyKey ? String(body.idempotencyKey) : undefined,
          });
          quotes.set(quote.idempotencyKey, quote);
          return { status: 402, body: { quote, ...x402PaymentRequired(quote) } };
        } catch (error) {
          return json(400, { error: error instanceof Error ? error.message : 'Invalid quote' });
        }
      }

      if (path === '/jobs' && method === 'POST') {
        if (!payer) return json(401, { error: 'Wallet session required' });
        const body = record(req.body);
        const idempotencyKey = String(body.idempotencyKey ?? '');
        const existing = idempotencyKey ? await store.getByIdempotencyKey(idempotencyKey) : null;
        if (existing) return json(200, { job: existing, replayed: true });
        const quote = quotes.get(idempotencyKey);
        if (!quote) return json(400, { error: 'Unknown or expired quote' });
        if (Date.parse(quote.expiresAt) <= Date.now()) return json(400, { error: 'Quote expired' });
        const paymentHeader = String(req.headers['x-payment'] ?? body.paymentHeader ?? '');
        const requirement = requirementFromQuote(quote);
        if (!options.allowMockPayment && paymentHeader.startsWith('mock:')) {
          return json(402, { error: 'Mock payment is disabled', ...x402PaymentRequired(quote) });
        }
        const verified = await facilitator.verify({ paymentHeader, requirement });
        if (!verified.valid) return json(402, { error: verified.error ?? 'Payment invalid', ...x402PaymentRequired(quote) });
        const settled = await facilitator.settle({ paymentHeader, requirement });
        if (!settled.success) {
          const job = failAfterPayment(newJob(quote, payer), settled.error ?? 'Settlement failed');
          await store.save(job);
          return json(402, { error: job.errorMessage, job });
        }
        const job = markPaid(newJob(quote, payer), {
          network: quote.network,
          asset: quote.asset,
          amount: quote.usdcAmount,
          payer,
          payTo: quote.payTo,
          settlementTx: settled.txHash,
          facilitator: options.allowMockPayment ? 'mock' : 'http',
          status: options.allowMockPayment ? 'mock' : 'settled',
        });
        await store.save(job);
        return json(201, { job });
      }

      const jobMatch = /^\/jobs\/([^/]+)$/.exec(path);
      if (jobMatch && method === 'GET') {
        const job = await store.getById(jobMatch[1]!);
        if (!job) return json(404, { error: 'Job not found' });
        return json(200, { job, mintEnabled: mintEnabled(job) });
      }

      const uploadMedia = /^\/jobs\/([^/]+)\/media$/.exec(path);
      if (uploadMedia && method === 'POST') {
        const job = await requireJob(store, uploadMedia[1]!, payer);
        if ('error' in job) return job;
        const body = record(req.body);
        const bytes = decodeBytes(body.bytes);
        const sha256 = contentHash(bytes);
        const expected = job.quote.files[0];
        if (!expected || expected.sha256 !== sha256) return json(400, { error: 'File hash does not match the quote' });
        try {
          const uploading = { ...job, status: 'uploading_media' as const, updatedAt: new Date().toISOString() };
          await store.save(uploading);
          const uploaded = await arweave.upload({ bytes, mimeType: expected.mimeType, tags: { 'File-Hash': sha256 } });
          const next = markMediaUploaded(uploading, {
            id: uploaded.id,
            sha256,
            mimeType: expected.mimeType,
            size: expected.size,
            gateways: [],
          });
          await store.save(next);
          return json(200, { job: next, simulated: uploaded.simulated ?? false });
        } catch (error) {
          const failed = failAfterPayment(job, error instanceof Error ? error.message : 'Media upload failed');
          await store.save(failed);
          return json(502, { error: failed.errorMessage, job: failed });
        }
      }

      const uploadMetadata = /^\/jobs\/([^/]+)\/metadata$/.exec(path);
      if (uploadMetadata && method === 'POST') {
        const job = await requireJob(store, uploadMetadata[1]!, payer);
        if ('error' in job) return job;
        if (!job.media) return json(400, { error: 'Upload media before metadata' });
        const body = record(req.body);
        const metadata = metadataObject({
          name: String(body.name ?? job.quote.files[0]?.name ?? 'Artwork'),
          description: body.description ? String(body.description) : undefined,
          mimeType: job.media.mimeType,
          mediaId: job.media.id,
          sha256: job.media.sha256,
        });
        const bytes = new TextEncoder().encode(JSON.stringify(metadata));
        try {
          const uploaded = await arweave.upload({ bytes, mimeType: 'application/json', tags: { 'Content-Type': 'application/json' } });
          const next = markMetadataUploaded(job, {
            id: uploaded.id,
            sha256: contentHash(bytes),
            mimeType: 'application/json',
            size: bytes.byteLength,
            gateways: [],
          });
          await store.save(next);
          return json(200, { job: next, metadata, simulated: uploaded.simulated ?? false });
        } catch (error) {
          const failed = failAfterPayment(job, error instanceof Error ? error.message : 'Metadata upload failed');
          await store.save(failed);
          return json(502, { error: failed.errorMessage, job: failed });
        }
      }

      const confirm = /^\/jobs\/([^/]+)\/confirm$/.exec(path);
      if (confirm && method === 'POST') {
        const job = await requireJob(store, confirm[1]!, payer);
        if ('error' in job) return job;
        if (!job.media || !job.metadata) return json(400, { error: 'Media and metadata are required before confirmation' });
        const media = await arweave.retrieve(job.media.id);
        const metadata = await arweave.retrieve(job.metadata.id);
        const next = markConfirmed(job, {
          mediaOk: media.ok,
          metadataOk: metadata.ok,
          checkedAt: new Date().toISOString(),
        });
        if (next.media) next.media = { ...next.media, gateways: media.gateways };
        if (next.metadata) next.metadata = { ...next.metadata, gateways: metadata.gateways };
        await store.save(next);
        return json(200, { job: next, mintEnabled: mintEnabled(next) });
      }

      const simulate = /^\/jobs\/([^/]+)\/simulate-failure$/.exec(path);
      if (simulate && method === 'POST') {
        const job = await requireJob(store, simulate[1]!, payer);
        if ('error' in job) return job;
        const next = failAfterPayment(job, 'Simulated failure after payment');
        await store.save(next);
        return json(200, { job: next });
      }

      return json(404, { error: 'Not found' });
    },
  };
}

async function requireJob(store: MediaStore, id: string, payer?: string) {
  const job = await store.getById(id);
  if (!job) return json(404, { error: 'Job not found' });
  if (payer && job.payerAddress !== payer) return json(403, { error: 'Forbidden' });
  return job;
}

function decodeBytes(value: unknown) {
  if (typeof value !== 'string') throw new Error('bytes must be base64');
  return new Uint8Array(Buffer.from(value, 'base64'));
}

export type { UploadJob };
