# All-in factory launch runbook

Companion to the all-in pre-main plan. No production Studio release until every gate below is green.

## Gates

1. Forge tests green (`packages/collection-contracts`)
2. Local anvil E2E (`./script/e2e-local.sh`) writes `deployments/anvil.json`
3. Media job machine tests + `pnpm exec tsx scripts/e2e-media-upload.mjs`
4. Factories deployed + verified on **Base and Ethereum** (721 + 1155)
5. `deployments/manifest.json` filled via `node scripts/record-factory-deployment.mjs …`
6. Studio env has `CHAIN_{id}_FACTORY_ADDRESS` and `CHAIN_{id}_ERC1155_FACTORY_ADDRESS`
7. Production media: `TURBO_PRIVATE_KEY`, `X402_FACILITATOR_URL`, `CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT=false`
8. Indexer hosted for `CHAIN_IDS=1,8453` with both factories
9. `./scripts/clean-room-reconstruction.sh` against a fresh Postgres

## Deploy commands

See [packages/collection-contracts/deployments/README.md](../../packages/collection-contracts/deployments/README.md).

## Studio env (host dashboards only)

```
STORAGE_POSTGRES_URL=…
TURBO_PRIVATE_KEY=…
X402_FACILITATOR_URL=…
CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT=false
CRYPTOART_MEDIA_NETWORK=eip155:8453
CRYPTOART_MEDIA_ASSET=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
CRYPTOART_MEDIA_PAY_TO=<treasury>
CRYPTOART_OWNER_ADDRESS=<platform owner>
CHAIN_8453_FACTORY_ADDRESS=…
CHAIN_8453_ERC1155_FACTORY_ADDRESS=…
CHAIN_1_FACTORY_ADDRESS=…
CHAIN_1_ERC1155_FACTORY_ADDRESS=…
```
