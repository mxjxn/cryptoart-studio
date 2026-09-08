import { describe, expect, it } from 'vitest';
import { contentHash, mintEnabled, quoteUpload } from './jobs';
import { createMemoryMediaStore } from './store';
import { createSimulatedArweave } from './arweave';
import { createMockFacilitator } from './x402';
import { createMediaRouter } from './router';

describe('paid upload job machine', () => {
  it('quotes, settles once, uploads media then metadata, and confirms retrieval', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const sha256 = contentHash(bytes);
    const router = createMediaRouter({
      store: createMemoryMediaStore(),
      facilitator: createMockFacilitator(),
      arweave: createSimulatedArweave(),
      payTo: '0x1111111111111111111111111111111111111111',
      allowMockPayment: true,
    });
    const quoted = await router.handle({
      method: 'POST', pathname: '/quote', headers: {},
      body: { files: [{ name: 'work.png', mimeType: 'image/png', size: bytes.byteLength, sha256 }] },
    });
    expect(quoted.status).toBe(402);
    const idempotencyKey = (quoted.body as { quote: { idempotencyKey: string } }).quote.idempotencyKey;
    const paid = await router.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' },
      payer: '0x2222222222222222222222222222222222222222',
      body: { idempotencyKey },
    });
    expect(paid.status).toBe(201);
    const replay = await router.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' },
      payer: '0x2222222222222222222222222222222222222222',
      body: { idempotencyKey },
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

  it('turns a post-payment failure into a durable credit', async () => {
    const bytes = new Uint8Array([9]);
    const router = createMediaRouter({
      payTo: '0x1111111111111111111111111111111111111111',
      allowMockPayment: true,
    });
    const quoted = await router.handle({
      method: 'POST', pathname: '/quote', headers: {},
      body: { files: [{ name: 'a.png', mimeType: 'image/png', size: 1, sha256: contentHash(bytes) }] },
    });
    const idempotencyKey = (quoted.body as { quote: { idempotencyKey: string } }).quote.idempotencyKey;
    const paid = await router.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' },
      payer: '0x2222222222222222222222222222222222222222',
      body: { idempotencyKey },
    });
    const jobId = (paid.body as { job: { id: string } }).job.id;
    const failed = await router.handle({
      method: 'POST', pathname: `/jobs/${jobId}/simulate-failure`, headers: {},
      payer: '0x2222222222222222222222222222222222222222',
      body: {},
    });
    expect((failed.body as { job: { status: string; credit: { amount: string } } }).job.status).toBe('credit_owed');
    expect(mintEnabled((failed.body as { job: Parameters<typeof mintEnabled>[0] }).job)).toBe(false);
  });

  it('quotes a positive USDC amount from file size', () => {
    const quote = quoteUpload({
      files: [{ name: 'a', mimeType: 'image/png', size: 1_000_000, sha256: 'ab' }],
      payTo: '0x1111111111111111111111111111111111111111',
    });
    expect(Number(quote.usdcAmount)).toBeGreaterThan(0);
  });
});
