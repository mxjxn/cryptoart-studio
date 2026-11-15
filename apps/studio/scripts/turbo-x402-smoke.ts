#!/usr/bin/env node
/**
 * Local-only Turbo x402 settlement smoke test.
 * Reads TURBO_X402_SMOKE_PRIVATE_KEY from the shell — never from repo files.
 * Do not run in CI.
 */
import { setTimeout as delay } from 'node:timers/promises';

const GATEWAYS = ['https://arweave.net', 'https://ar-io.net'];

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg: string) {
  console.log(`PASS: ${msg}`);
}

function assertLocalOnly() {
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true' || process.env.VERCEL === '1') {
    fail('This script is local-only and must not run in CI or Vercel.');
  }
}

function usage() {
  console.log(`Turbo x402 local smoke test (Base Sepolia by default)

Environment:
  TURBO_X402_SMOKE_PRIVATE_KEY   Required. Hex private key for a throwaway test wallet (set in shell only).
  CRYPTOART_MEDIA_TURBO_UPLOAD_URL Optional. Default https://upload.ardrive.io

Flags:
  --mainnet       Use Base mainnet (network=base, chain id 8453) instead of Base Sepolia
  --help          Show this help

Example:
  export TURBO_X402_SMOKE_PRIVATE_KEY=0xabc...
  pnpm --filter studio smoke:turbo-x402
`);
}

async function pollGateways(id: string, maxAttempts = 20) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const hits: string[] = [];
    for (const origin of GATEWAYS) {
      try {
        const response = await fetch(`${origin}/${id}`, { method: 'HEAD', signal: AbortSignal.timeout(20_000) });
        if (response.ok) hits.push(origin);
      } catch {
        // retry
      }
    }
    if (hits.length > 0) return hits;
    console.log(`  waiting for gateways (${attempt}/${maxAttempts})…`);
    await delay(15_000);
  }
  return [];
}

async function main() {
  assertLocalOnly();
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return;
  }
  const mainnet = args.includes('--mainnet');
  const privateKey = process.env.TURBO_X402_SMOKE_PRIVATE_KEY?.trim();
  if (!privateKey) {
    usage();
    fail('Set TURBO_X402_SMOKE_PRIVATE_KEY in your shell (never commit it).');
  }

  const uploadUrl = process.env.CRYPTOART_MEDIA_TURBO_UPLOAD_URL ?? 'https://upload.ardrive.io';
  const x402Network = mainnet ? 'base' : 'base-sepolia';
  const gatewayUrl = mainnet ? undefined : 'https://sepolia.base.org';

  const payload = new TextEncoder().encode(`cryptoart-studio turbo x402 smoke ${new Date().toISOString()}`);

  const { TurboFactory } = await import('@ardrive/turbo-sdk');

  const turbo = TurboFactory.authenticated({
    privateKey,
    token: 'base-usdc',
    ...(gatewayUrl ? { gatewayUrl } : {}),
    ...(uploadUrl !== 'https://upload.ardrive.io' ? { uploadServiceConfig: { url: uploadUrl } } : {}),
  });

  console.log(`Network: ${mainnet ? 'Base mainnet' : 'Base Sepolia'} (x402 network=${x402Network})`);
  console.log(`Upload service: ${uploadUrl}`);

  const price = await turbo.getX402PriceForRawData({
    byteCount: payload.byteLength,
    network: x402Network,
    tagCount: 1,
    contentType: 'text/plain',
  });
  console.log(`Quoted ${price.usdcAmount} atomic USDC for ${payload.byteLength} bytes`);
  pass('Turbo x402 price response received');

  const maxMUSDC = BigInt(price.usdcAmount) + 50_000n;
  const uploaded = await turbo.uploadRawX402Data({
    data: payload,
    maxMUSDCAmount: maxMUSDC,
    tags: [{ name: 'Content-Type', value: 'text/plain' }],
  });
  const id = uploaded.id;
  if (!id) fail('Upload succeeded but no transaction id returned');
  console.log(`Uploaded id=${id}`);
  pass('Turbo x402 upload accepted');

  const gateways = await pollGateways(id);
  if (gateways.length === 0) {
    fail(`Item ${id} not yet visible on arweave.net or ar-io.net after polling.`);
  }
  pass(`Gateways readable: ${gateways.join(', ')}`);
  console.log('\nAll checks passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});