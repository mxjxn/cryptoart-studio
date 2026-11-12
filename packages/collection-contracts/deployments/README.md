# SuchCollection factory deployments

Checked-in recovery input for Studio + the collection indexer.

**Status (2026-11-12):** Base (`8453`) and Ethereum (`1`) factory addresses in [`manifest.json`](./manifest.json) are still `null`. No operator broadcast has been recorded. Only the anvil local proof addresses are filled. Full catch-up: [`docs/plans/2026-11-12-branch-catchup-and-factory-status.md`](../../../docs/plans/2026-11-12-branch-catchup-and-factory-status.md).

## Local proof

```bash
cd packages/collection-contracts
./script/e2e-local.sh
```

Writes `deployments/anvil.json` and updates smoke addresses.

## Mainnet / Base broadcast (operator)

Requires secrets set in your shell (never commit them):

- `PLATFORM_OWNER_ADDRESS` — Ownable of both factories (use the cryptoart owner / multisig)
- `DEPLOYER_PRIVATE_KEY` or Foundry keystore
- `BASE_RPC_URL` / `ETH_RPC_URL`
- Basescan / Etherscan API keys for verify

```bash
# Base
forge script script/DeployFactory.s.sol:DeployFactory \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast --verify \
  -vvvv

# Ethereum
forge script script/DeployFactory.s.sol:DeployFactory \
  --rpc-url "$ETH_RPC_URL" \
  --broadcast --verify \
  -vvvv
```

Then record addresses, deploy tx hashes, and `startBlock` into `manifest.json`.

Studio / indexer env (set in host dashboards; agents do not write `.env*`):

```
CHAIN_IDS=1,8453
CHAIN_8453_RPC_URL=...
CHAIN_8453_FACTORY_ADDRESS=0x...
CHAIN_8453_ERC1155_FACTORY_ADDRESS=0x...
CHAIN_8453_START_BLOCK=...
CHAIN_1_RPC_URL=...
CHAIN_1_FACTORY_ADDRESS=0x...
CHAIN_1_ERC1155_FACTORY_ADDRESS=0x...
CHAIN_1_START_BLOCK=...
```

## Verify after deploy

```bash
forge verify-contract <FACTORY_721> src/SuchCollectionFactory.sol:SuchCollectionFactory \
  --chain-id 8453 --constructor-args $(cast abi-encode "constructor(address)" $PLATFORM_OWNER_ADDRESS)

forge verify-contract <FACTORY_1155> src/SuchCollection1155Factory.sol:SuchCollection1155Factory \
  --chain-id 8453 --constructor-args $(cast abi-encode "constructor(address)" $PLATFORM_OWNER_ADDRESS)
```
