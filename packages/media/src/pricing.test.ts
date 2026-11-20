import { describe, expect, it } from 'vitest';
import { contentHash } from './jobs';
import { createMemoryMediaStore } from './store';
import { createMediaRouter } from './router';

const payer = '0x2222222222222222222222222222222222222222';

const stubQuoteBundle = async () => ({
  winston: '0',
  usd: 0.1,
  source: 'turbo' as const,
  usdcAmount: '100000',
  mediaUsdcAmount: '90000',
  metadataUsdcAmount: '10000',
});

const testRouterOpts = { allowMockPayment: true, quoteBundle: stubQuoteBundle };

describe('Turbo upload quote', () => {
  it('quotes a positive USDC amount from Turbo x402 totals', async () => {
    const { quoteUpload } = await import('./jobs');
    const quote = quoteUpload({
      files: [{ name: 'a.png', mimeType: 'image/png', size: 1_000_000, sha256: 'ab' }],
      cost: { winston: '0', usd: 2.63, source: 'turbo', usdcAmount: '2630000', mediaUsdcAmount: '2500000', metadataUsdcAmount: '130000' },
    });
    expect(quote.usdcAmount).toBe('2630000');
    expect(quote.usdcDisplay).toBe('2.63');
    expect(quote.costSource).toBe('turbo');
  });

  it('reads a Turbo fiat estimate without inventing an AR spot price', async () => {
    const { costFromTurboEstimate } = await import('./quote');
    expect(costFromTurboEstimate({ amount: 2.62672542, winc: '14288340335' })).toEqual({
      winston: '14288340335',
      usd: 2.62672542,
      source: 'turbo',
    });
    expect(() => costFromTurboEstimate({ amount: -1, winc: '1' })).toThrow(/usd/i);
    expect(() => costFromTurboEstimate({ amount: 1, winc: 'nope' })).toThrow(/winc/i);
  });

  it('sums integer atomic USDC quotes for media and metadata', async () => {
    const { sumUsdcAtomic } = await import('./quote');
    expect(sumUsdcAtomic(['40000', '10000'])).toBe('50000');
  });
});

describe('mock payment gate', () => {
  it('treats CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT=false as disabled in every environment', async () => {
    const { resolveAllowMockPayment } = await import('./paymentPolicy');
    expect(resolveAllowMockPayment({
      CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT: 'false',
      NODE_ENV: 'production',
    })).toBe(false);
    expect(resolveAllowMockPayment({
      CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT: 'false',
      NODE_ENV: 'development',
    })).toBe(false);
    expect(resolveAllowMockPayment({ NODE_ENV: 'production' })).toBe(false);
    expect(resolveAllowMockPayment({
      CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT: 'true',
      NODE_ENV: 'production',
    })).toBe(true);
  });

  it('does not accept mock headers when mock payment is disabled', async () => {
    const store = createMemoryMediaStore();
    const router = createMediaRouter({
      store,
      allowMockPayment: false,
      quoteBundle: stubQuoteBundle,
    });
    const bytes = new Uint8Array([1, 2, 3]);
    const quoted = await router.handle({
      method: 'POST',
      pathname: '/quote',
      headers: {},
      body: { files: [{ name: 'a.png', mimeType: 'image/png', size: bytes.byteLength, sha256: contentHash(bytes) }] },
    });
    const idempotencyKey = (quoted.body as { quote: { idempotencyKey: string } }).quote.idempotencyKey;
    const paid = await router.handle({
      method: 'POST',
      pathname: '/jobs',
      headers: {},
      payer,
      body: { idempotencyKey, quote: (quoted.body as { quote: unknown }).quote, paymentHeader: 'mock:allow' },
    });
    expect(paid.status).toBe(403);
    expect((await store.getByIdempotencyKey(idempotencyKey))?.payment ?? null).toBeNull();
  });
});

describe('quote handoff', () => {
  it('opens a job from a quote saved for the signed-in artist on another router instance', async () => {
    const store = createMemoryMediaStore();
    const shared = { ...testRouterOpts, store };
    const quotedBy = createMediaRouter(shared);
    const paidBy = createMediaRouter(shared);
    const bytes = new Uint8Array([7, 7]);
    const quoted = await quotedBy.handle({
      method: 'POST', pathname: '/quote', headers: {}, payer,
      body: { files: [{ name: 'a.png', mimeType: 'image/png', size: bytes.byteLength, sha256: contentHash(bytes) }] },
    });
    const quote = (quoted.body as { quote: { idempotencyKey: string } }).quote;
    const paid = await paidBy.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' }, payer,
      body: { idempotencyKey: quote.idempotencyKey, quote },
    });
    expect(paid.status).toBe(200);
    expect((paid.body as { job: { status: string } }).job.status).toBe('paid');
  });

  it('rejects a resubmitted quote that undercuts the current Turbo price', async () => {
    const store = createMemoryMediaStore();
    const cheap = createMediaRouter({ allowMockPayment: true, store, quoteBundle: async () => ({ ...await stubQuoteBundle(), usdcAmount: '10000' }) });
    const expensive = createMediaRouter({
      allowMockPayment: true,
      store,
      quoteBundle: async () => ({ ...await stubQuoteBundle(), usdcAmount: '5000000' }),
    });
    const quoted = await cheap.handle({
      method: 'POST', pathname: '/quote', headers: {},
      body: { files: [{ name: 'a.png', mimeType: 'image/png', size: 10, sha256: 'ab' }] },
    });
    const quote = (quoted.body as { quote: UploadQuote }).quote;
    const paid = await expensive.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' }, payer,
      body: { idempotencyKey: quote.idempotencyKey, quote: { ...quote, usdcAmount: '10000' } },
    });
    expect(paid.status).toBe(400);
    expect((paid.body as { error: string }).error).toMatch(/cover the current Turbo price/i);
  });
});

describe('pin result for the mint flow', () => {
  it('returns an ar:// URI and a gateway URL only after the file is uploaded', async () => {
    const { pinnedMediaForMint } = await import('./pin');
    const router = createMediaRouter(testRouterOpts);
    const bytes = new Uint8Array([9, 9, 9]);
    const sha256 = contentHash(bytes);
    const quoted = await router.handle({
      method: 'POST', pathname: '/quote', headers: {},
      body: { files: [{ name: 'work.png', mimeType: 'image/png', size: bytes.byteLength, sha256 }] },
    });
    const quote = (quoted.body as { quote: { idempotencyKey: string } }).quote;
    const paid = await router.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' }, payer,
      body: { idempotencyKey: quote.idempotencyKey, quote },
    });
    const jobId = (paid.body as { job: { id: string } }).job.id;
    const before = await router.handle({ method: 'GET', pathname: `/jobs/${jobId}`, headers: {}, payer, body: {} });
    expect((before.body as { pin: null }).pin).toBeNull();
    await router.handle({
      method: 'POST', pathname: `/jobs/${jobId}/media`, headers: {}, payer,
      body: { bytes: Buffer.from(bytes).toString('base64') },
    });
    await router.handle({
      method: 'POST', pathname: `/jobs/${jobId}/metadata`, headers: {}, payer,
      body: { name: 'Work' },
    });
    const confirmed = await router.handle({
      method: 'POST', pathname: `/jobs/${jobId}/confirm`, headers: {}, payer, body: {},
    });
    const pin = (confirmed.body as { pin: { mediaUri: string; metadataUri: string; metadataGatewayUrl: string; mintEnabled: boolean } }).pin;
    expect(pin.mintEnabled).toBe(true);
    expect(pin.mediaUri).toMatch(/^ar:\/\//);
    expect(pin.metadataUri).toMatch(/^ar:\/\//);
    expect(pin.metadataGatewayUrl).toMatch(/^https:\/\/arweave\.net\//);
    expect(pinnedMediaForMint((confirmed.body as { job: Parameters<typeof pinnedMediaForMint>[0] }).job)?.metadataUri).toBe(pin.metadataUri);
  });
});

type UploadQuote = import('./types').UploadQuote;