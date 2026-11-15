import {
  contentHash,
  failAfterPayment,
  markConfirmed,
  markMediaUploaded,
  markMetadataUploaded,
  markReady,
  mintEnabled,
  newJob,
  quoteUpload,
} from './jobs';
import { pinnedMediaForMint } from './pin';
import { isMockPaymentHeader } from './paymentPolicy';
import { METADATA_ALLOWANCE_BYTES } from './quote';
import { quoteTurboX402Bundle, type TurboX402Quote } from './turboCost';
import { turboX402NetworkFromEip155 } from './turboX402Network';
import { createSimulatedArweave, metadataObject } from './arweave';
import { createMemoryMediaStore, type MediaStore } from './store';
import type { ArweaveAdapter, FileQuoteInput, UploadJob, UploadQuote } from './types';

type MediaRequest = {
  method: string;
  pathname: string;
  headers: Record<string, string | undefined>;
  body: unknown;
  payer?: string;
};

type MediaResponse = { status: number; body: unknown };

function json(status: number, body: unknown): MediaResponse {
  return { status, body };
}

function record(body: unknown) {
  return body && typeof body === 'object' ? body as Record<string, unknown> : {};
}

function paymentHeaderFrom(req: MediaRequest, body: Record<string, unknown>) {
  const header = req.headers['payment-signature'] ?? req.headers['x-payment'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (typeof body.paymentHeader === 'string') return body.paymentHeader.trim();
  return '';
}

function sameFiles(left: FileQuoteInput[], right: FileQuoteInput[]) {
  if (left.length !== right.length) return false;
  return left.every((file, index) => {
    const other = right[index];
    if (!other) return false;
    return file.name === other.name
      && file.mimeType === other.mimeType
      && file.size === other.size
      && file.sha256 === other.sha256;
  });
}

function isFileQuote(value: unknown): value is FileQuoteInput {
  if (!value || typeof value !== 'object') return false;
  const file = value as Partial<FileQuoteInput>;
  return typeof file.name === 'string'
    && typeof file.mimeType === 'string'
    && typeof file.size === 'number'
    && Number.isInteger(file.size)
    && file.size > 0
    && typeof file.sha256 === 'string'
    && file.sha256.length > 0;
}

function readQuote(value: unknown): UploadQuote | null {
  if (!value || typeof value !== 'object') return null;
  const quote = value as Partial<UploadQuote>;
  if (typeof quote.idempotencyKey !== 'string' || !quote.idempotencyKey) return null;
  if (!Array.isArray(quote.files) || quote.files.length === 0 || !quote.files.every(isFileQuote)) return null;
  if (typeof quote.usdcAmount !== 'string' || !/^[0-9]+$/.test(quote.usdcAmount)) return null;
  if (typeof quote.network !== 'string' || typeof quote.asset !== 'string') return null;
  if (typeof quote.expiresAt !== 'string') return null;
  return quote as UploadQuote;
}

function readArweaveRecord(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const record = value as { id?: string; sha256?: string; mimeType?: string; size?: number };
  if (typeof record.id !== 'string' || !record.id) return null;
  if (typeof record.sha256 !== 'string' || record.sha256.length === 0) return null;
  if (typeof record.mimeType !== 'string') return null;
  if (!Number.isInteger(record.size) || (record.size ?? 0) < 0) return null;
  return {
    id: record.id,
    sha256: record.sha256,
    mimeType: record.mimeType,
    size: record.size ?? 0,
    gateways: [] as string[],
  };
}

export function createMediaRouter(options: {
  store?: MediaStore;
  arweave?: ArweaveAdapter;
  allowMockPayment?: boolean;
  network?: string;
  asset?: string;
  uploadServiceUrl?: string;
  /** Test hook to avoid live Turbo pricing in unit tests. */
  quoteBundle?: (input: { fileBytes: number; mimeType: string; network: ReturnType<typeof turboX402NetworkFromEip155> }) => Promise<TurboX402Quote>;
}) {
  const store = options.store ?? createMemoryMediaStore();
  const arweave = options.arweave ?? createSimulatedArweave();
  const allowMock = options.allowMockPayment === true;
  const mediaNetwork = options.network ?? 'eip155:84532';
  const mediaAsset = options.asset;

  async function buildQuote(files: FileQuoteInput[], idempotencyKey?: string) {
    const primary = files[0];
    if (!primary) throw new Error('At least one file is required');
    const x402Network = turboX402NetworkFromEip155(mediaNetwork);
    const cost = await (options.quoteBundle ?? ((input) => quoteTurboX402Bundle({
      ...input,
      uploadServiceUrl: options.uploadServiceUrl,
    })))({
      fileBytes: primary.size,
      mimeType: primary.mimeType,
      network: x402Network,
    });
    return quoteUpload({
      files,
      cost,
      network: mediaNetwork,
      asset: mediaAsset,
      idempotencyKey,
      metadataAllowanceBytes: METADATA_ALLOWANCE_BYTES,
    });
  }

  function clientQuoteCovers(submitted: UploadQuote, fresh: UploadQuote) {
    if (submitted.network !== fresh.network || submitted.asset.toLowerCase() !== fresh.asset.toLowerCase()) {
      return 'Quote network does not match this studio';
    }
    if (!sameFiles(submitted.files, fresh.files)) return 'Quote files do not match';
    const expires = Date.parse(submitted.expiresAt);
    if (!Number.isFinite(expires) || expires <= Date.now()) return 'Quote expired';
    if (expires > Date.now() + 16 * 60 * 1000) return 'Quote expiry is too far in the future';
    if (BigInt(submitted.usdcAmount) < BigInt(fresh.usdcAmount)) return 'Quote does not cover the current Turbo price';
    return null;
  }

  async function resolveQuote(idempotencyKey: string, body: Record<string, unknown>, existing: UploadJob | null): Promise<{ quote: UploadQuote } | { error: string; status?: number }> {
    const cached = quotes.get(idempotencyKey) ?? (existing?.quote.idempotencyKey === idempotencyKey ? existing.quote : undefined);
    if (cached) {
      if (Date.parse(cached.expiresAt) <= Date.now()) return { error: 'Quote expired' as const };
      return { quote: cached };
    }
    const submitted = readQuote(body.quote);
    if (!submitted || submitted.idempotencyKey !== idempotencyKey) return { error: 'Unknown or expired quote' as const };
    let fresh: UploadQuote;
    try {
      fresh = await buildQuote(submitted.files);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Turbo price quote failed';
      return { error: message, status: /turbo/i.test(message) ? 502 : 400 };
    }
    const mismatch = clientQuoteCovers(submitted, fresh);
    if (mismatch) return { error: mismatch };
    return { quote: submitted };
  }

  const quotes = new Map<string, UploadQuote>();

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
          const quote = await buildQuote(files, body.idempotencyKey ? String(body.idempotencyKey) : undefined);
          quotes.set(quote.idempotencyKey, quote);
          if (payer) {
            const prior = await store.getByIdempotencyKey(quote.idempotencyKey);
            if (!prior) await store.save({ ...newJob(quote, payer), status: 'payment_required' });
          }
          return json(200, { quote });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid quote';
          return json(/turbo/i.test(message) ? 502 : 400, { error: message });
        }
      }

      if (path === '/jobs' && method === 'POST') {
        if (!payer) return json(401, { error: 'Wallet session required' });
        const body = record(req.body);
        const idempotencyKey = String(body.idempotencyKey ?? '');
        if (!idempotencyKey) return json(400, { error: 'idempotencyKey is required' });
        const existing = await store.getByIdempotencyKey(idempotencyKey);
        const resolved = await resolveQuote(idempotencyKey, body, existing);
        if (!('quote' in resolved)) {
          return json(resolved.status ?? 400, { error: resolved.error });
        }
        const quote = resolved.quote;
        const paymentHeader = paymentHeaderFrom(req, body);
        let payment: UploadJob['payment'] = {
          network: quote.network,
          asset: quote.asset,
          amount: '0',
          payer,
          payTo: '',
          facilitator: 'turbo-x402',
          status: 'settled',
        };
        if (isMockPaymentHeader(paymentHeader)) {
          if (!allowMock) {
            return json(403, { error: 'Mock payment is disabled', code: 'mock_payment_disabled' });
          }
          payment = {
            network: quote.network,
            asset: quote.asset,
            amount: quote.usdcAmount,
            payer,
            payTo: '',
            facilitator: 'mock',
            status: 'mock',
          };
        }
        if (existing) {
          if (existing.status !== 'failed' && existing.status !== 'confirmed' && !existing.media) {
            const refreshed = markReady({ ...existing, payerAddress: payer, quote }, payment);
            await store.save(refreshed);
            return json(200, { job: refreshed, replayed: true, pin: pinnedMediaForMint(refreshed) });
          }
          return json(200, { job: existing, replayed: true, pin: pinnedMediaForMint(existing) });
        }
        const job = markReady(newJob(quote, payer), payment);
        await store.save(job);
        return json(201, { job, pin: pinnedMediaForMint(job) });
      }

      const jobMatch = /^\/jobs\/([^/]+)$/.exec(path);
      if (jobMatch && method === 'GET') {
        const job = await store.getById(jobMatch[1]!);
        if (!job) return json(404, { error: 'Job not found' });
        return json(200, { job, mintEnabled: mintEnabled(job), pin: pinnedMediaForMint(job) });
      }

      const uploadMedia = /^\/jobs\/([^/]+)\/media$/.exec(path);
      if (uploadMedia && method === 'POST') {
        const found = await requireJob(store, uploadMedia[1]!, payer);
        if (!found.ok) return found.response;
        const job = found.job;
        const body = record(req.body);
        const expected = job.quote.files[0];
        if (!expected) return json(400, { error: 'Quote has no media file' });

        const clientRecord = readArweaveRecord(body.record);
        if (clientRecord) {
          if (clientRecord.sha256 !== expected.sha256) return json(400, { error: 'File hash does not match the quote' });
          const next = markMediaUploaded(job, {
            ...clientRecord,
            mimeType: expected.mimeType,
            size: expected.size,
          });
          await store.save(next);
          return json(200, { job: next, simulated: false, pin: pinnedMediaForMint(next) });
        }

        if (!allowMock || job.payment?.facilitator !== 'mock') {
          return json(400, { error: 'Upload the media via Turbo x402 from the browser, then submit { record: { id, sha256, mimeType, size } }' });
        }

        let bytes: Uint8Array;
        try {
          bytes = decodeBytes(body.bytes);
        } catch (error) {
          return json(400, { error: error instanceof Error ? error.message : 'Invalid media bytes' });
        }
        const sha256 = contentHash(bytes);
        if (expected.sha256 !== sha256) return json(400, { error: 'File hash does not match the quote' });
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
          return json(200, { job: next, simulated: uploaded.simulated ?? false, pin: pinnedMediaForMint(next) });
        } catch (error) {
          const failed = failAfterPayment(job, error instanceof Error ? error.message : 'Media upload failed');
          await store.save(failed);
          return json(502, { error: failed.errorMessage, job: failed });
        }
      }

      const uploadMetadata = /^\/jobs\/([^/]+)\/metadata$/.exec(path);
      if (uploadMetadata && method === 'POST') {
        const found = await requireJob(store, uploadMetadata[1]!, payer);
        if (!found.ok) return found.response;
        const job = found.job;
        if (!job.media) return json(400, { error: 'Upload media before metadata' });
        const body = record(req.body);

        const clientRecord = readArweaveRecord(body.record);
        if (clientRecord) {
          const next = markMetadataUploaded(job, clientRecord);
          await store.save(next);
          return json(200, { job: next, simulated: false, pin: pinnedMediaForMint(next) });
        }

        if (!allowMock || job.payment?.facilitator !== 'mock') {
          return json(400, { error: 'Upload metadata via Turbo x402 from the browser, then submit { record: { id, sha256, mimeType, size } }' });
        }

        const attributes = Array.isArray(body.attributes)
          ? (body.attributes as Array<{ trait_type?: string; value?: string | number }>)
              .filter((attribute) => attribute && attribute.trait_type && attribute.value !== undefined && attribute.value !== '')
              .map((attribute) => ({ trait_type: String(attribute.trait_type), value: attribute.value as string | number }))
          : undefined;
        const metadata = metadataObject({
          name: String(body.name ?? job.quote.files[0]?.name ?? 'Artwork'),
          description: body.description ? String(body.description) : undefined,
          mimeType: job.media.mimeType,
          mediaId: job.media.id,
          sha256: job.media.sha256,
          animationUrl: body.animation_url || body.animationUrl ? String(body.animation_url ?? body.animationUrl) : undefined,
          attributes,
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
          return json(200, { job: next, metadata, simulated: uploaded.simulated ?? false, pin: pinnedMediaForMint(next) });
        } catch (error) {
          const failed = failAfterPayment(job, error instanceof Error ? error.message : 'Metadata upload failed');
          await store.save(failed);
          return json(502, { error: failed.errorMessage, job: failed });
        }
      }

      const confirm = /^\/jobs\/([^/]+)\/confirm$/.exec(path);
      if (confirm && method === 'POST') {
        const found = await requireJob(store, confirm[1]!, payer);
        if (!found.ok) return found.response;
        const job = found.job;
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
        return json(200, { job: next, mintEnabled: mintEnabled(next), pin: pinnedMediaForMint(next) });
      }

      const simulate = /^\/jobs\/([^/]+)\/simulate-failure$/.exec(path);
      if (simulate && method === 'POST') {
        if (!allowMock) return json(404, { error: 'Not found' });
        const found = await requireJob(store, simulate[1]!, payer);
        if (!found.ok) return found.response;
        const job = found.job;
        const next = failAfterPayment(job, 'Simulated failure after payment');
        await store.save(next);
        return json(200, { job: next });
      }

      return json(404, { error: 'Not found' });
    },
  };
}

async function requireJob(store: MediaStore, id: string, payer?: string): Promise<{ ok: true; job: UploadJob } | { ok: false; response: MediaResponse }> {
  const job = await store.getById(id);
  if (!job) return { ok: false, response: json(404, { error: 'Job not found' }) };
  if (payer && job.payerAddress !== payer) return { ok: false, response: json(403, { error: 'Forbidden' }) };
  return { ok: true, job };
}

function decodeBytes(value: unknown) {
  if (typeof value !== 'string') throw new Error('bytes must be base64');
  return new Uint8Array(Buffer.from(value, 'base64'));
}

export type { UploadJob };