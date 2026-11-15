import { describe, expect, it } from 'vitest';
import { contentHash } from './jobs';
import { createMemoryMediaStore } from './store';
import { createMediaRouter } from './router';
import type { UploadCost } from './quote';

const payTo = '0x1111111111111111111111111111111111111111';
const payer = '0x2222222222222222222222222222222222222222';

function stubCost(usdPerByte = 0): (byteCount: number) => Promise<UploadCost> {
  return async (byteCount) => ({
    winston: (BigInt(byteCount) * 1_000n).toString(),
    usd: usdPerByte === 0 ? Number(byteCount) / 100 : byteCount * usdPerByte,
    source: 'turbo',
  });
}

describe('Turbo upload quote', () => {
  it('prices USDC from a Turbo USD estimate instead of $8 per AR', async () => {
    const { quoteUpload } = await import('./jobs');
    const quote = quoteUpload({
      files: [{ name: 'a.png', mimeType: 'image/png', size: 1_000_000, sha256: 'ab' }],
      payTo,
      safetyMarginBps: 0,
      cost: { winston: '1000000000000', usd: 2.63, source: 'turbo' },
    });
    expect(quote.usdcAmount).toBe('2630000');
    expect(quote.usdcDisplay).toBe('2.63');
    expect(quote.arweaveWinston).toBe('1000000000000');
    expect(quote.costSource).toBe('turbo');
    expect(quote.usdcAmount).not.toBe('8000000');
  });

  it('adds the safety margin on top of the Turbo USD price', async () => {
    const { quoteUpload } = await import('./jobs');
    const quote = quoteUpload({
      files: [{ name: 'a.png', mimeType: 'image/png', size: 10, sha256: 'ab' }],
      payTo,
      safetyMarginBps: 500,
      cost: { winston: '1000000', usd: 1, source: 'turbo' },
    });
    expect(quote.usdcAmount).toBe('1050000');
    expect(quote.arweaveWinston).toBe('1050000');
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

  it('asks Turbo for the artwork and a separate metadata allowance', async () => {
    const { quoteTurboBundle, METADATA_ALLOWANCE_BYTES } = await import('./turboCost');
    const seen: number[] = [];
    const cost = await quoteTurboBundle(500, async (byteCount) => {
      seen.push(byteCount);
      return { winston: String(byteCount), usd: byteCount / 100, source: 'turbo' };
    });
    expect(seen).toEqual([500, METADATA_ALLOWANCE_BYTES]);
    expect(cost.winston).toBe(String(500 + METADATA_ALLOWANCE_BYTES));
  });

  it('sums cent-rounded Turbo USD amounts without a binary float artifact', async () => {
    const { sumUploadCosts } = await import('./quote');
    expect(sumUploadCosts([
      { winston: '1', usd: 0.06, source: 'turbo' },
      { winston: '1', usd: 0.01, source: 'turbo' },
    ]).usd).toBe(0.07);
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
    expect(resolveAllowMockPayment({
      CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT: 'FALSE',
      NODE_ENV: 'development',
    })).toBe(false);
    expect(resolveAllowMockPayment({ NODE_ENV: 'production' })).toBe(false);
    expect(resolveAllowMockPayment({
      CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT: 'true',
      NODE_ENV: 'production',
    })).toBe(true);
  });

  it('does not settle a mock header when mock payment is disabled, even if the facilitator would accept it', async () => {
    const calls: string[] = [];
    const facilitator = {
      kind: 'http' as const,
      async verify() {
        calls.push('verify');
        return { valid: true, payer };
      },
      async settle() {
        calls.push('settle');
        return { success: true, txHash: '0xsettled' };
      },
    };
    const store = createMemoryMediaStore();
    const router = createMediaRouter({
      store,
      facilitator,
      payTo,
      allowMockPayment: false,
      costSource: stubCost(),
    });
    const bytes = new Uint8Array([1, 2, 3]);
    const quoted = await router.handle({
      method: 'POST',
      pathname: '/quote',
      headers: {},
      body: { files: [{ name: 'a.png', mimeType: 'image/png', size: bytes.byteLength, sha256: contentHash(bytes) }] },
    });
    const idempotencyKey = (quoted.body as { quote: { idempotencyKey: string } }).quote.idempotencyKey;
    for (const header of ['mock:allow', 'Mock:allow', ' mock:allow ']) {
      const paid = await router.handle({
        method: 'POST',
        pathname: '/jobs',
        headers: {},
        payer,
        body: { idempotencyKey, paymentHeader: header },
      });
      expect(paid.status).toBe(403);
      expect((paid.body as { code?: string }).code).toBe('mock_payment_disabled');
    }
    expect(calls).toEqual([]);
    expect((await store.getByIdempotencyKey(idempotencyKey))?.payment ?? null).toBeNull();
  });

  it('refuses to settle through the mock facilitator when mock payment is disabled', async () => {
    const router = createMediaRouter({
      payTo,
      allowMockPayment: false,
      costSource: stubCost(),
    });
    const bytes = new Uint8Array([4]);
    const quoted = await router.handle({
      method: 'POST',
      pathname: '/quote',
      headers: {},
      body: { files: [{ name: 'a.png', mimeType: 'image/png', size: 1, sha256: contentHash(bytes) }] },
    });
    const idempotencyKey = (quoted.body as { quote: { idempotencyKey: string } }).quote.idempotencyKey;
    const paid = await router.handle({
      method: 'POST',
      pathname: '/jobs',
      headers: { 'x-payment': 'exact-payment-header' },
      payer,
      body: { idempotencyKey },
    });
    expect(paid.status).toBe(503);
    expect((paid.body as { code?: string }).code).toBe('facilitator_not_configured');
  });
});

describe('quote handoff', () => {
  it('pays a quote saved for the signed-in artist on another router instance', async () => {
    const store = createMemoryMediaStore();
    const shared = { payTo, allowMockPayment: true, costSource: stubCost(), store };
    const quotedBy = createMediaRouter(shared);
    const paidBy = createMediaRouter(shared);
    const bytes = new Uint8Array([7, 7]);
    const quoted = await quotedBy.handle({
      method: 'POST', pathname: '/quote', headers: {}, payer,
      body: { files: [{ name: 'a.png', mimeType: 'image/png', size: bytes.byteLength, sha256: contentHash(bytes) }] },
    });
    const idempotencyKey = (quoted.body as { quote: { idempotencyKey: string } }).quote.idempotencyKey;
    const paid = await paidBy.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' }, payer,
      body: { idempotencyKey },
    });
    expect(paid.status).toBe(200);
    expect((paid.body as { job: { status: string } }).job.status).toBe('paid');
  });

  it('rejects a resubmitted quote that undercuts the current Turbo price', async () => {
    const cheap = createMediaRouter({ payTo, allowMockPayment: true, costSource: stubCost() });
    const expensive = createMediaRouter({
      payTo,
      allowMockPayment: true,
      costSource: async () => ({ winston: '1', usd: 40, source: 'turbo' }),
    });
    const quoted = await cheap.handle({
      method: 'POST', pathname: '/quote', headers: {},
      body: { files: [{ name: 'a.png', mimeType: 'image/png', size: 10, sha256: 'ab' }] },
    });
    const quote = (quoted.body as { quote: { idempotencyKey: string; usdcAmount: string } }).quote;
    const paid = await expensive.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' }, payer,
      body: { idempotencyKey: quote.idempotencyKey, quote: { ...quote, usdcAmount: '10000' } },
    });
    expect(paid.status).toBe(400);
    expect((paid.body as { error: string }).error).toMatch(/cover the current Turbo price/i);
  });

  it('rejects a resubmitted quote whose files are not file quotes', async () => {
    const router = createMediaRouter({ payTo, allowMockPayment: true, costSource: stubCost() });
    const paid = await router.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' }, payer,
      body: {
        idempotencyKey: 'abc',
        quote: {
          idempotencyKey: 'abc',
          files: [null],
          usdcAmount: '10000',
          payTo,
          network: 'eip155:84532',
          asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
    });
    expect(paid.status).toBe(400);
    expect((paid.body as { error: string }).error).toMatch(/unknown or expired quote/i);
  });
});

describe('pin result for the mint flow', () => {
  it('returns an ar:// URI and a gateway URL only after the file is uploaded', async () => {
    const { pinnedMediaForMint } = await import('./pin');
    const router = createMediaRouter({
      payTo,
      allowMockPayment: true,
      costSource: stubCost(),
    });
    const bytes = new Uint8Array([9, 9, 9]);
    const sha256 = contentHash(bytes);
    const quoted = await router.handle({
      method: 'POST', pathname: '/quote', headers: {},
      body: { files: [{ name: 'work.png', mimeType: 'image/png', size: bytes.byteLength, sha256 }] },
    });
    const idempotencyKey = (quoted.body as { quote: { idempotencyKey: string } }).quote.idempotencyKey;
    const paid = await router.handle({
      method: 'POST', pathname: '/jobs', headers: { 'x-payment': 'mock:allow' }, payer,
      body: { idempotencyKey },
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
