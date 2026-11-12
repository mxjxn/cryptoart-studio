# Preview factory deploy (Base Sepolia)

**Updated:** 2026-11-12

## Scope split

| Goal | What you need |
|------|----------------|
| **Test NFT factories** on a Studio preview | Base Sepolia deploy of 721+1155 factories + preview env vars |
| **imgnAI Hypersnap validator** | Writable Snapchain/Hypersnap submit for **casts** — separate from factories. Useful for Social compose later; not used to deploy contracts. |

## Operator checklist (factories)

1. Fund a deployer wallet on **Base Sepolia** (chain id `84532`).
2. Choose `PLATFORM_OWNER_ADDRESS` (can be the same wallet for preview).
3. In a shell (not committed):

```bash
export PLATFORM_OWNER_ADDRESS=0x...
export DEPLOYER_PRIVATE_KEY=0x...
# optional RPC override:
# export BASE_SEPOLIA_RPC_URL=https://...
cd packages/collection-contracts
./script/deploy-preview-base-sepolia.sh
```

4. Copy printed `CHAIN_84532_*` values into the Studio preview project env on Vercel (Preview environment for this branch).
5. Open Studio preview → Collections → New → choose **Base Sepolia** → deploy a test collection.

## What to send the agent if you want us to run the script

Do **not** paste private keys into chat if you can avoid it. Prefer exporting them in the Cloud Agent terminal yourself, then say “keys are exported, run the preview deploy script.”

If you must share, provide:

- `PLATFORM_OWNER_ADDRESS`
- Confirmation deployer is funded on Base Sepolia
- That `DEPLOYER_PRIVATE_KEY` is available in the agent shell env (you set it)
- Optional custom `BASE_SEPOLIA_RPC_URL`

## Hypersnap / imgnAI (for later compose)

When ready for Social writes, share:

- Submit base URL (HTTP `POST /v1/submitMessage` and/or gRPC host:port)
- Auth requirements (none / basic / bearer)
- Whether it is validator-direct or read-node relay

That path is documented in [2026-11-12-hypersnap-write-path.md](./2026-11-12-hypersnap-write-path.md).
