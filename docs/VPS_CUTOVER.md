# Hostinger VPS cutover (cryptoart.social)

**Status:** Implementation in repo. DNS cutover is an ops step on the VPS.  
**Product order:** VPS first → Hypersnap social → Studio mint / lazy mint → LSSVM → STP.

## Architecture (cutover day)

```
Internet → host nginx (staging.cryptoart.social, then cryptoart.social)
         → Docker mvp:3000 (apps/mvp standalone)
         → Supabase cryptoart-db (STORAGE_POSTGRES_URL)  ← existing data + RLS
         → Redis (local Docker)
         → Cloudflare R2 (thumbnails / IPFS cache)
         → Auctionhouse subgraph + RPC
         → cron container → mvp /api/cron/* (Bearer CRON_SECRET)
```

**Do not** start the `postgres` compose profile for production cutover. That profile is for a later self-host migration only.

## Prerequisites on the VPS

1. Docker + Compose plugin, host nginx, certbot (see [DEPLOYMENT_PRODUCTION.md](./DEPLOYMENT_PRODUCTION.md)).
2. Clone repo to `/opt/cryptoart` (or `DEPLOY_PATH`).
3. Secrets:
   ```bash
   mkdir -p /opt/cryptoart/secrets && chmod 700 /opt/cryptoart/secrets
   # redis password file required by compose
   openssl rand -hex 24 > /opt/cryptoart/secrets/redis_password.txt
   chmod 600 /opt/cryptoart/secrets/redis_password.txt
   ```
4. `.env.production` (never commit). Minimum:

```bash
NEXT_PUBLIC_URL=https://staging.cryptoart.social   # then https://cryptoart.social
STORAGE_POSTGRES_URL=postgresql://...              # existing cryptoart-db pooler URL
POSTGRES_URL=${STORAGE_POSTGRES_URL}
CRON_SECRET=...                                    # same secret used by cron Bearer
NEYNAR_API_KEY=...
NEYNAR_CLIENT_ID=...
RPC_URL=...
CHAIN_ID=8453

# Object storage — required on VPS (prefer R2 over Vercel Blob)
R2_BUCKET=...
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_URL=https://<public-cdn-or-r2-dev-domain>
R2_REGION=auto
```

5. Build / pull images:
   ```bash
   cd /opt/cryptoart
   docker compose -f docker-compose.prod.yml build mvp cron indexer
   docker compose -f docker-compose.prod.yml up -d
   ```

## Staging shadow → DNS

1. Create DNS `A` for `staging.cryptoart.social` → VPS IP. Keep `cryptoart.social` on Vercel.
2. Enable [nginx/sites-available/staging.cryptoart.social.example](../nginx/sites-available/staging.cryptoart.social.example).
3. `certbot --nginx -d staging.cryptoart.social`
4. Smoke checklist vs Vercel production:
   - `GET /api/health` → `{ ok: true }`
   - `/market` first paint / TTFB
   - Open a live auction, confirm bid UI
   - Follow / favorite
   - Existing curation gallery page
   - Admin featured rails (if you have admin access)
5. Lower TTL on `cryptoart.social` (e.g. 300s) a day before cutover.
6. Point `cryptoart.social` (+ www) A/AAAA to the VPS. Update `NEXT_PUBLIC_URL` and re-issue certs using [nginx/sites-available/cryptoart.social.example](../nginx/sites-available/cryptoart.social.example).
7. Keep the Vercel project as rollback for a few days (do not delete).

## What replaced Vercel-only pieces

| Vercel | VPS |
|--------|-----|
| `apps/mvp` serverless / Fluid | `Dockerfile.mvp` → `mvp` service, `output: 'standalone'` |
| Vercel Cron (`vercel.json`) | `Dockerfile.cron` + `deploy/cron/crontab` |
| Vercel Blob | Cloudflare R2 via `object-storage.ts` (`R2_*`) |
| Vercel Postgres / managed URL | Same Supabase URL on the VPS (no new empty DB) |

## After the site is stable on metal

Parked until then (do not merge into the lift-and-shift):

- `feat/social-web-foundation` — Hypersnap / Farcaster-compatible social client
- Studio minting completion + **lazy mint** productization
- [such-lssvm](https://github.com/mxjxn/such-lssvm) pools
- [stp-v2](https://github.com/mxjxn/stp-v2) memberships

See [PLATFORM_ROADMAP.md](./PLATFORM_ROADMAP.md).

## Rollback

1. Point DNS back to Vercel.
2. `docker compose -f docker-compose.prod.yml stop mvp cron` on the VPS if needed.
3. Supabase data is shared — do not run destructive migrations during the shadow window.
