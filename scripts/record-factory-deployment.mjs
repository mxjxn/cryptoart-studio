#!/usr/bin/env node
/**
 * Merge a broadcast deploy into deployments/manifest.json.
 *
 * Usage:
 *   node scripts/record-factory-deployment.mjs \
 *     --chain-id 8453 \
 *     --erc721 0x... \
 *     --erc1155 0x... \
 *     --start-block 12345678 \
 *     --tx-721 0x... \
 *     --tx-1155 0x... \
 *     --verified
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const chainId = Number(arg('chain-id'));
if (!Number.isFinite(chainId)) {
  console.error('Missing --chain-id');
  process.exit(1);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(repoRoot, 'packages/collection-contracts/deployments/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const chain = manifest.chains.find((c) => c.chainId === chainId);
if (!chain) {
  console.error(`No chain entry for ${chainId}`);
  process.exit(1);
}

const erc721 = arg('erc721');
const erc1155 = arg('erc1155');
if (erc721) chain.factories.erc721 = erc721;
if (erc1155) chain.factories.erc1155 = erc1155;

const startBlock = arg('start-block');
if (startBlock) chain.startBlock = Number(startBlock);

chain.deployTxHashes = chain.deployTxHashes ?? {};
const tx721 = arg('tx-721');
const tx1155 = arg('tx-1155');
if (tx721) chain.deployTxHashes.erc721 = tx721;
if (tx1155) chain.deployTxHashes.erc1155 = tx1155;

if (process.argv.includes('--verified')) {
  chain.verified = { erc721: Boolean(chain.factories.erc721), erc1155: Boolean(chain.factories.erc1155) };
}

try {
  manifest.gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
} catch {
  manifest.gitCommit = 'unknown';
}
manifest.generatedAt = new Date().toISOString();

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(chain, null, 2));
