# All-in factory launch runbook

**Updated:** 2026-11-12  
Companion to the all-in pre-main plan. No production Studio release until every gate below is green.

**Operator progress:** as of 2026-11-12, **no manual Base/Ethereum broadcast has been done**. `deployments/manifest.json` still has `null` factory addresses for chain `1` and `8453`. Only anvil local addresses are recorded.

Branch context (stacked tip, not on `main`): see [2026-11-12-branch-catchup-and-factory-status.md](./2026-11-12-branch-catchup-and-factory-status.md).

---

## Gates

| # | Gate | Status (Nov 12) |
|---|------|-----------------|
| 1 | Forge tests green (`packages/collection-contracts`) | Done in agent (Nov 3) |
| 2 | Local anvil E2E (`./script/e2e-local.sh`) → `deployments/anvil.json` | Done in agent (Nov 3) |
| 3 | Media job machine tests + `pnpm exec tsx scripts/e2e-media-upload.mjs` | Done (sim/mock) |
| 4 | Factories deployed + verified on **Base and Ethereum** (721 + 1155) | **Not started** |
| 5 | `deployments/manifest.json` filled via `node scripts/record-factory-deployment.mjs …` | Base/Eth still null |
| 6 | Studio env has `CHAIN_{id}_FACTORY_ADDRESS` and `CHAIN_{id}_ERC1155_FACTORY_ADDRESS` | **Not set** |
| 7 | Production media: `TURBO_PRIVATE_KEY`, `X402_FACILITATOR_URL`, `CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT=false` | **Not set** |
| 8 | Indexer hosted for `CHAIN_IDS=1,8453` with both factories | **Not started** |
| 9 | `./scripts/clean-room-reconstruction.sh` against a fresh Postgres | Dry-validation only |

---

## Deploy commands (operator)

Secrets stay in your shell / host dashboards — agents do not read or write `.env*`.

See [packages/collection-contracts/deployments/README.md](../../packages/collection-contracts/deployments/README.md).

```bash
# From packages/collection-contracts
# Requires: PLATFORM_OWNER_ADDRESS, funded deployer key, BASE_RPC_URL / ETH_RPC_URL, explorer API keys

forge script script/DeployFactory.s.sol:DeployFactory \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast --verify \
  -vvvv

forge script script/DeployFactory.s.sol:DeployFactory \
  --rpc-url "$ETH_RPC_URL" \
  --broadcast --verify \
  -vvvv

# Record (example)
node ../../scripts/record-factory-deployment.mjs \
  --chain-id 8453 \
  --erc721 0x... \
  --erc1155 0x... \
  --start-block <deploy_block> \
  --tx-721 0x... \
  --tx-1155 0x... \
  --verified
```

Then set Studio + indexer env and run:

```bash
./scripts/clean-room-reconstruction.sh
```

---

## Studio / indexer env (host dashboards only)

```
STORAGE_POSTGRES_URL=…
TURBO_PRIVATE_KEY=…
X402_FACILITATOR_URL=…
CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT=false
CRYPTOART_MEDIA_NETWORK=eip155:8453
CRYPTOART_MEDIA_ASSET=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
CRYPTOART_MEDIA_PAY_TO=<treasury>
CRYPTOART_OWNER_ADDRESS=<platform owner>
CHAIN_IDS=1,8453
CHAIN_8453_RPC_URL=…
CHAIN_8453_FACTORY_ADDRESS=…
CHAIN_8453_ERC1155_FACTORY_ADDRESS=…
CHAIN_8453_START_BLOCK=…
CHAIN_1_RPC_URL=…
CHAIN_1_FACTORY_ADDRESS=…
CHAIN_1_ERC1155_FACTORY_ADDRESS=…
CHAIN_1_START_BLOCK=…
```
