# cryptoart-snap

Farcaster **Snap** (Hono on Vercel Edge) for **read-only** gallery and listing teasers. Fetches public data from the CryptoArt MVP API and returns snap JSON; primary actions use **`open_mini_app`** to `https://cryptoart.social`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CRYPTOART_APP_URL` | Recommended | Production MVP origin, no trailing slash. Default: `https://cryptoart.social`. Used for `fetch()` to `/api/curation/...` and `/api/auctions/...`, and for deep links. |
| `SNAP_PUBLIC_BASE_URL` | Recommended in production | Canonical public origin of **this** snap, e.g. `https://snap.cryptoart.social`. No trailing slash. Ensures any future `submit` targets match what clients call. |
| `SKIP_JFS_VERIFICATION` | Local only | Set to `true` for local `pnpm dev` POST tests. **Never** in production. |

## Query parameters

- **Gallery teaser:**
  `/?kind=gallery&identifier=<usernameOr0xAddress>&slug=<gallerySlug>`
- **Listing teaser:**
  `/?kind=listing&listingId=<id>`

Omitting `kind` shows a short help snap.

## Local development

```bash
cd apps/cryptoart-snap
pnpm install   # from monorepo root: pnpm install
pnpm dev
```

Server listens on **http://localhost:3003** (see `src/server.ts`).

**GET (snap JSON):**

```bash
curl -sS -H 'Accept: application/vnd.farcaster.snap+json' \
  'http://localhost:3003/?kind=gallery&identifier=YOUR_USER&slug=YOUR_SLUG'
```

**POST** (button interaction) — requires JFS-shaped body; with `SKIP_JFS_VERIFICATION=true`:

```bash
PAYLOAD=$(echo -n "{\"fid\":1,\"inputs\":{},\"button_index\":0,\"timestamp\":$(date +%s)}" \
  | base64 | tr '+/' '-_' | tr -d '=')
curl -sS -X POST -H 'Accept: application/vnd.farcaster.snap+json' \
  -H 'Content-Type: application/json' \
  -d "{\"header\":\"dev\",\"payload\":\"$PAYLOAD\",\"signature\":\"dev\"}" \
  'http://localhost:3003/?kind=listing&listingId=1'
```

## Deploy on Vercel

1. Create a **second Vercel project** with **Root Directory** `apps/cryptoart-snap` (or deploy via CLI from this folder).
2. **Framework preset:** Hono (or Other + `src/index.ts` entry as per Vercel Hono docs).
3. Set **Environment Variables** in the project: `CRYPTOART_APP_URL`, `SNAP_PUBLIC_BASE_URL`.
4. Add DNS: **CNAME** `snap` → Vercel, then attach domain **`snap.cryptoart.social`** in the project settings.
5. **Do not** deploy `src/server.ts` as the runtime entry — Vercel uses Edge; `server.ts` is local dev only.

**Verify production:**

```bash
curl -sS -H 'Accept: application/vnd.farcaster.snap+json' \
  'https://snap.cryptoart.social/?kind=listing&listingId=YOUR_ID'
```

Expect `200` and `Content-Type: application/vnd.farcaster.snap+json`.

## Alternative: host.neynar.app

See [Farcaster snap SKILL.md](https://docs.farcaster.xyz/snap/SKILL.md) and `curl -fsSL https://host.neynar.app/SKILL.md` for packaging with `framework=hono`.

## Optional: slim gallery JSON on MVP

The MVP exposes **`GET /api/snap/gallery?identifier=…&slug=…`** with `Cache-Control` and a reduced payload (`apps/mvp`). The snap currently calls the full **`/api/curation/user/.../gallery/...`** endpoint; you can point `fetchGallery` at the slim route later if you need smaller responses or faster Edge execution.

## Monorepo

This package is part of `cryptoart-monorepo`. It does **not** import MVP internals; only HTTPS JSON APIs.
