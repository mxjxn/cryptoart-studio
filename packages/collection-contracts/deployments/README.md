# SuchCollection factory deployments

Checked-in recovery input for Studio + the collection indexer.

**Status (2026-11-12):** Base Sepolia (`84532`), Base (`8453`), and Ethereum (`1`) factory addresses in [`manifest.json`](./manifest.json) are still `null` for live networks. Only the anvil local proof addresses are filled. Full catch-up: [`docs/plans/2026-11-12-branch-catchup-and-factory-status.md`](../../../docs/plans/2026-11-12-branch-catchup-and-factory-status.md).

**Note:** An imgnAI / Hypersnap validator is for **Farcaster message submit** (Social compose). It does **not** deploy NFT factories. Factories need a chain RPC + funded deployer key.

## Local proof

```bash
cd packages/collection-contracts
./script/e2e-local.sh
```

Writes `deployments/anvil.json` and updates smoke addresses.

## Preview / test — Base Sepolia (branch deploys)

```bash
export PLATFORM_OWNER_ADDRESS=0x...   # factory Ownable
export DEPLOYER_PRIVATE_KEY=0x...     # funded on Base Sepolia
# optional:
# export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

cd packages/collection-contracts
./script/deploy-preview-base-sepolia.sh
```

Then set on the Studio **preview** host (do this yourself in Vercel; agents do not write `.env*`):

```
CHAIN_84532_FACTORY_ADDRESS=…
CHAIN_84532_ERC1155_FACTORY_ADDRESS=…
CHAIN_84532_START_BLOCK=…
```

Wizard includes **Base Sepolia** as the preview chain option.

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
