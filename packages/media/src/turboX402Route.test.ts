import { describe, expect, it } from 'vitest';
import { contentHash } from './jobs';
import { createMediaRouter } from './router';
import { createMemoryMediaStore } from './store';
import type { ArweaveAdapter } from './types';

const payer = '0x2222222222222222222222222222222222222222';

const stubQuoteBundle = async () => ({
  winston: '0',
  usd: 0.02,
  source: 'turbo' as const,
  usdcAmount: '20000',
  mediaUsdcAmount: '15000',
  metadataUsdcAmount: '5000',
});

function gatewayOkArweave(): ArweaveAdapter {
  return {
    async upload() {
      throw new Error('server upload disabled');
    },
    async retrieve(id) {
      return { ok: true, gateways: ['https://arweave.net', 'https://ar-io.net'] };
    },
  };
}

describe('Turbo x402 register + confirm routes', () => {
  it('accepts client-reported arweave ids without base64 bytes and confirms mint', async () => {
    const store = createMemoryMediaStore();
    const router = createMediaRouter({
      store,
      arweave: gatewayOkArweave(),
      allowMockPayment: false,
      quoteBundle: stubQuoteBundle,
    });
    const bytes = new Uint8Array([5, 6, 7]);
    const sha256 = contentHash(bytes);
    const quoted = await router.handle({
      method: 'POST',
      pathname: '/quote',
      headers: {},
      body: { files: [{ name: 'x.png', mimeType: 'image/png', size: bytes.byteLength, sha256 }] },
    });
    const quote = (quoted.body as { quote: { idempotencyKey: string } }).quote;
    const opened = await router.handle({
      method: 'POST',
      pathname: '/jobs',
      headers: {},
      payer,
      body: { idempotencyKey: quote.idempotencyKey, quote },
    });
    const jobId = (opened.body as { job: { id: string } }).job.id;

    const media = await router.handle({
      method: 'POST',
      pathname: `/jobs/${jobId}/media`,
      headers: {},
      payer,
      body: {
        record: {
          id: 'arweave-media-tx-id',
          sha256,
          mimeType: 'image/png',
          size: bytes.byteLength,
        },
      },
    });
    expect(media.status).toBe(200);

    const metadataBytes = new TextEncoder().encode('{"name":"x"}');
    const metaHash = contentHash(metadataBytes);
    const metadata = await router.handle({
      method: 'POST',
      pathname: `/jobs/${jobId}/metadata`,
      headers: {},
      payer,
      body: {
        record: {
          id: 'arweave-meta-tx-id',
          sha256: metaHash,
          mimeType: 'application/json',
          size: metadataBytes.byteLength,
        },
      },
    });
    expect(metadata.status).toBe(200);

    const confirmed = await router.handle({
      method: 'POST',
      pathname: `/jobs/${jobId}/confirm`,
      headers: {},
      payer,
      body: {},
    });
    expect(confirmed.status).toBe(200);
    expect((confirmed.body as { mintEnabled: boolean }).mintEnabled).toBe(true);
    const pin = (confirmed.body as { pin: { mediaUri: string; metadataUri: string } }).pin;
    expect(pin.mediaUri).toBe('ar://arweave-media-tx-id');
    expect(pin.metadataUri).toBe('ar://arweave-meta-tx-id');
  });

  it('rejects base64 upload without mock mode', async () => {
    const router = createMediaRouter({
      allowMockPayment: false,
      quoteBundle: stubQuoteBundle,
    });
    const bytes = new Uint8Array([1]);
    const sha256 = contentHash(bytes);
    const quoted = await router.handle({
      method: 'POST',
      pathname: '/quote',
      headers: {},
      body: { files: [{ name: 'a.png', mimeType: 'image/png', size: 1, sha256 }] },
    });
    const quote = (quoted.body as { quote: { idempotencyKey: string } }).quote;
    const opened = await router.handle({
      method: 'POST',
      pathname: '/jobs',
      headers: {},
      payer,
      body: { idempotencyKey: quote.idempotencyKey, quote },
    });
    const jobId = (opened.body as { job: { id: string } }).job.id;
    const media = await router.handle({
      method: 'POST',
      pathname: `/jobs/${jobId}/media`,
      headers: {},
      payer,
      body: { bytes: Buffer.from(bytes).toString('base64') },
    });
    expect(media.status).toBe(400);
    expect((media.body as { error: string }).error).toMatch(/Turbo x402/i);
  });
});