import { describe, expect, it } from 'vitest';
import { contentHash, mintEnabled, quoteUpload } from './jobs';
import { createMemoryMediaStore } from './store';
import { createSimulatedArweave } from './arweave';
import { createMediaRouter } from './router';
const stubQuoteBundle = async () => ({
  winston: '0',
  usd: 0.05,
  source: 'turbo' as const,
  usdcAmount: '50000',
  mediaUsdcAmount: '40000',
  metadataUsdcAmount: '10000',
});

function testRouter() {
  return createMediaRouter({
    store: createMemoryMediaStore(),
    arweave: createSimulatedArweave(),
    allowMockPayment: true,
    quoteBundle: stubQuoteBundle,
  });
}

describe('paid upload job machine', () => {
  it('quotes, opens a job, uploads media then metadata, and confirms retrieval', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const sha256 = contentHash(bytes);
    const router = testRouter();
    const quoted = await router.handle({
      method: 'POST', pathname: '/quote', headers: {},
      body: { files: [{ name: 'work.png', mimeType: 'image/png', size: bytes.byteLength, sha256 }] },
    });
    expect(quoted.status).toBe(200);
    const idempotencyKey = (quoted.body as { quote: { idempotencyKey: string } }).quote.idempotencyKey;
    const paid = await router.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' },
      payer: '0x2222222222222222222222222222222222222222',
      body: { idempotencyKey, quote: (quoted.body as { quote: unknown }).quote },
    });
    expect(paid.status).toBe(201);
    const replay = await router.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' },
      payer: '0x2222222222222222222222222222222222222222',
      body: { idempotencyKey, quote: (quoted.body as { quote: unknown }).quote },
    });
    expect((replay.body as { replayed: boolean }).replayed).toBe(true);
    const jobId = (paid.body as { job: { id: string } }).job.id;
    const media = await router.handle({
      method: 'POST', pathname: `/jobs/${jobId}/media`, headers: {},
      payer: '0x2222222222222222222222222222222222222222',
      body: { bytes: Buffer.from(bytes).toString('base64') },
    });
    expect(media.status).toBe(200);
    const metadata = await router.handle({
      method: 'POST', pathname: `/jobs/${jobId}/metadata`, headers: {},
      payer: '0x2222222222222222222222222222222222222222',
      body: { name: 'Work' },
    });
    expect(metadata.status).toBe(200);
    const confirmed = await router.handle({
      method: 'POST', pathname: `/jobs/${jobId}/confirm`, headers: {},
      payer: '0x2222222222222222222222222222222222222222',
      body: {},
    });
    expect(confirmed.status).toBe(200);
    expect((confirmed.body as { mintEnabled: boolean }).mintEnabled).toBe(true);
  });

  it('marks a simulated failure as failed instead of credit_owed', async () => {
    const bytes = new Uint8Array([9]);
    const router = testRouter();
    const quoted = await router.handle({
      method: 'POST', pathname: '/quote', headers: {},
      body: { files: [{ name: 'a.png', mimeType: 'image/png', size: 1, sha256: contentHash(bytes) }] },
    });
    const idempotencyKey = (quoted.body as { quote: { idempotencyKey: string } }).quote.idempotencyKey;
    const paid = await router.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' },
      payer: '0x2222222222222222222222222222222222222222',
      body: { idempotencyKey, quote: (quoted.body as { quote: unknown }).quote },
    });
    const jobId = (paid.body as { job: { id: string } }).job.id;
    const failed = await router.handle({
      method: 'POST', pathname: `/jobs/${jobId}/simulate-failure`, headers: {},
      payer: '0x2222222222222222222222222222222222222222',
      body: {},
    });
    expect((failed.body as { job: { status: string } }).job.status).toBe('failed');
    expect(mintEnabled((failed.body as { job: Parameters<typeof mintEnabled>[0] }).job)).toBe(false);
  });

  it('quotes a positive USDC amount from Turbo x402 pricing', () => {
    const quote = quoteUpload({
      files: [{ name: 'a', mimeType: 'image/png', size: 1_000_000, sha256: 'ab' }],
      cost: { winston: '0', usd: 0.5, source: 'turbo', usdcAmount: '500000' },
    });
    expect(Number(quote.usdcAmount)).toBeGreaterThan(0);
    expect(quote.costSource).toBe('turbo');
    expect(quote.usdcDisplay).toBe('0.5');
  });

  it('rejects mock payment headers when mock payment is disabled', async () => {
    const bytes = new Uint8Array([1]);
    const router = createMediaRouter({ allowMockPayment: false, quoteBundle: stubQuoteBundle });
    const quoted = await router.handle({
      method: 'POST', pathname: '/quote', headers: {},
      body: { files: [{ name: 'a.png', mimeType: 'image/png', size: 1, sha256: contentHash(bytes) }] },
    });
    const idempotencyKey = (quoted.body as { quote: { idempotencyKey: string } }).quote.idempotencyKey;
    const paid = await router.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' },
      payer: '0x2222222222222222222222222222222222222222',
      body: { idempotencyKey, quote: (quoted.body as { quote: unknown }).quote },
    });
    expect(paid.status).toBe(403);
    expect((paid.body as { code: string }).code).toBe('mock_payment_disabled');
  });
});