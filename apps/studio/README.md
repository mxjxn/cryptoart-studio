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
   - `CHAIN_{chainId}_FACTORY_ADDRESS` — per-chain factory (e.g. `CHAIN_11155111_FACTORY_ADDRESS` for Sepolia dev)
   - `CHAIN_8453_FACTORY_ADDRESS` — Base mainnet factory (when deployed)
   - `CHAIN_1_FACTORY_ADDRESS` — Ethereum mainnet factory (when deployed)

Build command: `pnpm build` (with filter) or default Next.js build from app root.

## Collections API

Routes live under `/api/collections/*` in this app (moved from `apps/mvp`).

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/collections/deploy` | Prepare unsigned factory tx |
| POST | `/api/collections/deploy/[deploymentId]/submit` | Record signed tx hash |
| GET | `/api/collections/deploy/[deploymentId]/status` | Poll deployment status |
| GET | `/api/collections` | List collections (`?owner=`, `?chainId=`, pagination) |
| GET/PATCH | `/api/collections/[collectionId]` | Detail; PATCH is owner-only metadata |
| GET | `/api/collections/[collectionId]/tokens` | Paginated tokens |
| GET | `/api/collections/[collectionId]/tokens/[tokenId]` | Token + transfer history |
| GET | `/api/collections/[collectionId]/transfers` | Transfer history |

Local smoke test (requires `STORAGE_POSTGRES_URL`):

```bash
curl "http://localhost:3001/api/collections?limit=1"
```

## Plan

See [docs/plans/2026-06-cryptoart-studio.md](../../docs/plans/2026-06-cryptoart-studio.md).

GitHub tracking: issues #159–#168, project [cryptoart.studio](https://github.com/users/mxjxn/projects/2).
