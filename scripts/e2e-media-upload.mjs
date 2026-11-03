#!/usr/bin/env node
/**
 * Local proof of the paid upload job machine (simulated Arweave + mock facilitator).
 * Production uses Turbo + HTTP facilitator with mock disabled.
 */
import {
  contentHash,
  createMediaRouter,
  createMemoryMediaStore,
  createMockFacilitator,
  createSimulatedArweave,
  mintEnabled,
} from '../packages/media/src/index.ts';

const bytes = new TextEncoder().encode('cryptoart-e2e-media');
const sha256 = contentHash(bytes);
const router = createMediaRouter({
  store: createMemoryMediaStore(),
  facilitator: createMockFacilitator(),
  arweave: createSimulatedArweave(),
  payTo: '0x1111111111111111111111111111111111111111',
  allowMockPayment: true,
});

const quoted = await router.handle({
  method: 'POST',
  pathname: '/quote',
  headers: {},
  body: { files: [{ name: 'work.png', mimeType: 'image/png', size: bytes.byteLength, sha256 }] },
});
if (quoted.status !== 402) throw new Error(`expected 402 quote, got ${quoted.status}`);
const idempotencyKey = quoted.body.quote.idempotencyKey;

const paid = await router.handle({
  method: 'POST',
  pathname: '/jobs',
  headers: { 'x-payment': 'mock:allow' },
  payer: '0x2222222222222222222222222222222222222222',
  body: { idempotencyKey },
});
if (paid.status !== 201) throw new Error(`pay failed: ${JSON.stringify(paid.body)}`);
const jobId = paid.body.job.id;

const media = await router.handle({
  method: 'POST',
  pathname: `/jobs/${jobId}/media`,
  headers: {},
  payer: '0x2222222222222222222222222222222222222222',
  body: { bytes: Buffer.from(bytes).toString('base64') },
});
if (media.status !== 200) throw new Error(`media failed: ${JSON.stringify(media.body)}`);

const metadata = await router.handle({
  method: 'POST',
  pathname: `/jobs/${jobId}/metadata`,
  headers: {},
  payer: '0x2222222222222222222222222222222222222222',
  body: {
    name: 'E2E Work',
    description: 'Local proof',
    attributes: [{ trait_type: 'Series', value: 'Anvil' }],
  },
});
if (metadata.status !== 200) throw new Error(`metadata failed: ${JSON.stringify(metadata.body)}`);

const confirmed = await router.handle({
  method: 'POST',
  pathname: `/jobs/${jobId}/confirm`,
  headers: {},
  payer: '0x2222222222222222222222222222222222222222',
  body: {},
});
if (confirmed.status !== 200 || !confirmed.body.mintEnabled) {
  throw new Error(`confirm failed: ${JSON.stringify(confirmed.body)}`);
}
if (!mintEnabled(confirmed.body.job)) throw new Error('mintEnabled false');

const uri = `ar://${confirmed.body.job.metadata.id}`;
console.log(JSON.stringify({ ok: true, jobId, metadataUri: uri, metadata: metadata.body.metadata }, null, 2));
