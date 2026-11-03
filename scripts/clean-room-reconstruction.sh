#!/usr/bin/env bash
# Clean-room reconstruction drill for SuchCollection indexes.
# Requires: STORAGE_POSTGRES_URL, chain RPCs, factory addresses from the manifest.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MANIFEST="${MANIFEST:-packages/collection-contracts/deployments/manifest.json}"
if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing $MANIFEST"
  exit 1
fi

if [[ -z "${STORAGE_POSTGRES_URL:-}" ]]; then
  echo "STORAGE_POSTGRES_URL is required for clean-room reconstruction"
  echo "Dry validation only: checking migrations + manifest shape"
  node -e '
    const fs = require("fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!m.chains?.length) throw new Error("manifest.chains empty");
    for (const c of m.chains) {
      if (c.chainId === 31337) continue;
      if (!c.factories) throw new Error("missing factories for " + c.chainId);
    }
    const migs = [
      "packages/db/migrations/0023_add_collection_tables.sql",
      "packages/db/migrations/0028_collection_token_standard.sql",
      "packages/db/migrations/0029_arweave_records.sql",
    ];
    for (const f of migs) if (!fs.existsSync(f)) throw new Error("missing " + f);
    console.log(JSON.stringify({ ok: true, mode: "dry-validation", chains: m.chains.map(c => c.chainId) }, null, 2));
  ' "$MANIFEST"
  exit 0
fi

echo "[clean-room] applying migrations"
for f in packages/db/migrations/0023_add_collection_tables.sql \
         packages/db/migrations/0026_identity_editorial_media.sql \
         packages/db/migrations/0027_collection_drafts.sql \
         packages/db/migrations/0028_collection_token_standard.sql \
         packages/db/migrations/0029_arweave_records.sql; do
  echo "  -> $f"
  psql "$STORAGE_POSTGRES_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "[clean-room] export indexer env from manifest (operator must set RPC URLs)"
node -e '
  const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const live = m.chains.filter(c => c.chainId !== 31337 && c.factories?.erc721 && c.factories?.erc1155);
  if (!live.length) {
    console.error("No fully recorded Base/Ethereum factories in manifest yet.");
    process.exit(2);
  }
  console.log("CHAIN_IDS=" + live.map(c => c.chainId).join(","));
  for (const c of live) {
    console.log(`CHAIN_${c.chainId}_FACTORY_ADDRESS=${c.factories.erc721}`);
    console.log(`CHAIN_${c.chainId}_ERC1155_FACTORY_ADDRESS=${c.factories.erc1155}`);
    console.log(`CHAIN_${c.chainId}_START_BLOCK=${c.startBlock}`);
  }
' "$MANIFEST"

echo "[clean-room] start indexer with those env vars, then spot-check collections/tokens"
echo "  pnpm --filter @cryptoart/collection-indexer start"
echo "[clean-room] ok"
