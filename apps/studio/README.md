# cryptoart.studio (`apps/studio`)

On-chain artist dashboard for collection deployment, minting, and contract management.

## Development

```bash
# From repo root
pnpm install
pnpm --filter studio dev
```

Runs at [http://localhost:3001](http://localhost:3001) (mvp uses 3000).

## Vercel deployment

1. Create a new Vercel project linked to this monorepo.
2. Set **Root Directory** to `apps/studio`.
3. Add domain `cryptoart.studio` (or preview subdomain first).
4. Environment variables (Stage A minimum):
   - `STORAGE_POSTGRES_URL` — shared with collection API / indexer
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — WalletConnect project ID (optional; default exists for dev)
   - `NEXT_PUBLIC_BASE_RPC_URL` / `NEXT_PUBLIC_MAINNET_RPC_URL` — optional RPC overrides
   - `NEXT_PUBLIC_APP_URL` — `https://cryptoart.studio`
   - `CHAIN_8453_FACTORY_ADDRESS` — Base mainnet factory (when deployed)
   - `CHAIN_1_FACTORY_ADDRESS` — Ethereum mainnet factory (when deployed)

Build command: `pnpm build` (with filter) or default Next.js build from app root.

## Plan

See [docs/plans/2026-06-cryptoart-studio.md](../../docs/plans/2026-06-cryptoart-studio.md).

GitHub tracking: issues #159–#168, project [cryptoart.studio](https://github.com/users/mxjxn/projects/2).
