#!/usr/bin/env bash
# Deploy 721 + 1155 factories to Base Sepolia for branch/preview testing.
# Does not write .env files. Exports nothing secret to git.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.foundry/bin:${PATH}"

: "${PLATFORM_OWNER_ADDRESS:?Set PLATFORM_OWNER_ADDRESS (factory Ownable)}"
: "${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY (funded on Base Sepolia)}"

RPC_URL="${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"

echo "[preview] deploying factories to Base Sepolia via ${RPC_URL}"
echo "[preview] platform owner: ${PLATFORM_OWNER_ADDRESS}"

OUT="$(
  forge script script/DeployFactory.s.sol:DeployFactory \
    --rpc-url "$RPC_URL" \
    --broadcast \
    --private-key "$DEPLOYER_PRIVATE_KEY" \
    -vvvv 2>&1
)"
echo "$OUT" | tee /tmp/such-base-sepolia-deploy.log

FACTORY_721="$(echo "$OUT" | sed -n 's/.*SuchCollectionFactory (ERC-721) deployed at:[[:space:]]*//p' | tail -1 | tr -d '\r')"
FACTORY_1155="$(echo "$OUT" | sed -n 's/.*SuchCollection1155Factory (ERC-1155) deployed at:[[:space:]]*//p' | tail -1 | tr -d '\r')"
BLOCK="$(cast block-number --rpc-url "$RPC_URL")"

if [[ -z "$FACTORY_721" || -z "$FACTORY_1155" ]]; then
  echo "[preview] failed to parse factory addresses; see /tmp/such-base-sepolia-deploy.log"
  exit 1
fi

mkdir -p deployments
cat > deployments/base-sepolia.json <<EOF
{
  "network": "base-sepolia",
  "chainId": 84532,
  "rpcUrl": "${RPC_URL}",
  "startBlock": ${BLOCK},
  "platformOwner": "${PLATFORM_OWNER_ADDRESS}",
  "factories": {
    "erc721": "${FACTORY_721}",
    "erc1155": "${FACTORY_1155}"
  },
  "solc": "0.8.27",
  "optimizer": { "enabled": true, "runs": 1000 },
  "notes": "Preview/test factories for branch deploys. Not production."
}
EOF

# record script resolves manifest from repo root (script lives in scripts/)
(cd "$ROOT/../.." && node scripts/record-factory-deployment.mjs \
  --chain-id 84532 \
  --erc721 "$FACTORY_721" \
  --erc1155 "$FACTORY_1155" \
  --start-block "$BLOCK") || true

echo
echo "[preview] ok"
echo "CHAIN_84532_FACTORY_ADDRESS=${FACTORY_721}"
echo "CHAIN_84532_ERC1155_FACTORY_ADDRESS=${FACTORY_1155}"
echo "CHAIN_84532_START_BLOCK=${BLOCK}"
echo "CHAIN_84532_FACTORY_START_BLOCK=${BLOCK}   # apps/jobs project (chain indexer factory watch)"
echo
echo "Set those on the Studio preview host (Vercel project env for this branch)."
echo "Artifact: packages/collection-contracts/deployments/base-sepolia.json"
