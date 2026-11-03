#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.foundry/bin:${PATH}"

ANVIL_PORT="${ANVIL_PORT:-8545}"
RPC_URL="${RPC_URL:-http://127.0.0.1:${ANVIL_PORT}}"
# Anvil default account #0
DEPLOYER_PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
PLATFORM_OWNER_ADDRESS="${PLATFORM_OWNER_ADDRESS:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"

cleanup() {
  if [[ -n "${ANVIL_PID:-}" ]] && kill -0 "$ANVIL_PID" 2>/dev/null; then
    kill "$ANVIL_PID" || true
    wait "$ANVIL_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if ! curl -sf -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  "$RPC_URL" >/dev/null 2>&1; then
  echo "[e2e] starting anvil on :${ANVIL_PORT}"
  anvil --port "$ANVIL_PORT" --block-time 1 >/tmp/such-anvil.log 2>&1 &
  ANVIL_PID=$!
  for _ in $(seq 1 30); do
    if curl -sf -X POST -H 'content-type: application/json' \
      --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
      "$RPC_URL" >/dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done
else
  echo "[e2e] reusing existing RPC at ${RPC_URL}"
fi

echo "[e2e] running LocalE2E forge script"
OUT="$(
  forge script script/LocalE2E.s.sol:LocalE2E \
    --rpc-url "$RPC_URL" \
    --broadcast \
    --private-key "$DEPLOYER_PRIVATE_KEY" \
    -vvvv 2>&1
)"
echo "$OUT" | tee /tmp/such-local-e2e.log

FACTORY_721="$(echo "$OUT" | sed -n 's/.*FACTORY_721[[:space:]]*//p' | tail -1 | tr -d '\r')"
FACTORY_1155="$(echo "$OUT" | sed -n 's/.*FACTORY_1155[[:space:]]*//p' | tail -1 | tr -d '\r')"
COLLECTION_721="$(echo "$OUT" | sed -n 's/.*COLLECTION_721[[:space:]]*//p' | tail -1 | tr -d '\r')"
COLLECTION_1155="$(echo "$OUT" | sed -n 's/.*COLLECTION_1155[[:space:]]*//p' | tail -1 | tr -d '\r')"
BLOCK="$(cast block-number --rpc-url "$RPC_URL")"

mkdir -p deployments
cat > deployments/anvil.json <<EOF
{
  "network": "anvil",
  "chainId": 31337,
  "rpcUrl": "${RPC_URL}",
  "startBlock": 0,
  "deployedAtBlock": ${BLOCK},
  "platformOwner": "${PLATFORM_OWNER_ADDRESS}",
  "factories": {
    "erc721": "${FACTORY_721}",
    "erc1155": "${FACTORY_1155}"
  },
  "smokeCollections": {
    "erc721": "${COLLECTION_721}",
    "erc1155": "${COLLECTION_1155}"
  },
  "solc": "0.8.27",
  "optimizer": { "enabled": true, "runs": 1000 },
  "notes": "Local E2E proof. Not for production."
}
EOF

echo "[e2e] wrote deployments/anvil.json"
echo "[e2e] FACTORY_721=${FACTORY_721}"
echo "[e2e] FACTORY_1155=${FACTORY_1155}"
echo "[e2e] ok"
