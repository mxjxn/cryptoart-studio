# Cryptoart Social

The actual Farcaster **web** client, ported into the Cryptoart monorepo. This is an initial development foundation, not a production replacement for MVP.

## Source layout

- `web/`: imported `farcaster-client/apps/farcaster-web`, retaining the React app, cast renderer, conversations, composer, profiles, and navigation.
- `packages/`: the web client's shared hooks, data, analytics, cryptography, and tooling. No Expo/mobile application is imported.
- `web/src/cryptoart/`: Cryptoart channel policy, scoring, listing URL parsing, Neynar normalization, local server adapter, and feed UI.
- `UPSTREAM.md` and `LICENSE`: source provenance and upstream license.

This is a nested pnpm workspace because the original client's React 19, Wagmi 3, and Tailwind 4 must not inherit MVP's global overrides. The outer Turbo workspace sees a dependency-free `social` wrapper. Keep installation scoped to this directory. Upstream packages are consumed as TypeScript source by Vite.

## Run

From this directory:

```sh
pnpm setup
cp web/.env.example web/.env.local
# Set NEYNAR_API_KEY in web/.env.local; never use a VITE_ prefix for the key.
pnpm dev
```

The existing ignored local environment may already be configured; do not overwrite it. Development serves `http://127.0.0.1:3002` over HTTP. Set `HTTPS=true` if HTTPS is needed for a later authentication integration.

From the monorepo root, use `pnpm setup:social`, `pnpm dev:social`, `pnpm build:social`, and `pnpm test:social`.

```sh
pnpm test         # Cryptoart behavioral tests
pnpm check-types  # Entire imported web app and consumed source packages
pnpm build       # Production frontend bundle
```

The feed API is currently a Vite development/preview middleware. A static deployment of `web/dist` alone will NOT provide `/api/cryptoart/feed`. Production API hosting, authorization, rate limits, persistent ingestion, and rollout are subsequent work.

## Confirmed policy

- Approved channels: cryptoart, degen-art, gen-art, ai-art, gifart, veg, kismet.
- Default composer channel: cryptoart, with approved-channel selection.
- Popular casts published within the last 24 hours interlaced with latest.
- Extra weight for actual likes from FID 4905; more FIDs can be added in `policy.ts`.
- Active-listing boosts, illustrated marketplace activity, inline bidding, and social 2D galleries are subsequent integrations.

The first tuning defaults are two popular slots to one latest slot, engagement `log2(1 + likes + 2 × recasts + replies)`, plus 20 for a verified like by FID 4905. Coefficients are provisional. A verified active listing can add 8, but the live adapter intentionally does not set that flag merely because a listing link exists.

## Feed behavior

Channel candidates are fetched server-side and checked against the allowlist. Each channel is paginated back through the 24-hour window with a bounded request budget (10 pages/channel). If the budget is exhausted, the response and UI disclose partial popularity coverage. A single recent page is never silently claimed to represent the whole window.

Curator reactions are fetched with Neynar's bulk casts endpoint and `viewer_fid=4905`. This is used only to establish likes for ranking; curator viewer state is never copied into the browsing user's reaction state. Missing reactions produce a degraded-source notice, not fabricated likes. Snapshots refresh on a 60-second cache; removed likes disappear when new snapshots are built.

Ranking and interlacing happen before pagination. Cursors identify retained snapshots, scoped to the selected channel, for 10 minutes. Refreshing another view does not reshuffle an existing page sequence. Candidate casts are deduplicated by hash. New content does not automatically jump into a reading session.

References:
- https://docs.neynar.com/reference/fetch-feed-by-channel-ids
- https://docs.neynar.com/reference/fetch-bulk-casts

## Working now

- Live public approved-channel feed using the original Farcaster cast presentation.
- Popular/latest mixing, verified weighted-like scoring, channel selection, refresh, pagination, source errors, and development ranking explanations.
- Artwork image and Open Graph mapping into the upstream embed model.
- Cryptoart listing URL recognition for Base/Ethereum, including legacy chain query links, with canonical links into the existing marketplace.
- Approved-channel composer selector and default in the imported composer.
- Analytics disabled unless a Cryptoart-owned PostHog key is explicitly configured.

## Not yet completed

- Cryptoart authentication and posting signer integration. Imported login, secondary routes, and social write actions still use upstream API assumptions; they are not verified Cryptoart integrations.
- Personalization and authenticated viewer blocks/mutes. This first adapter is a public read feed.
- Chain-verified active-listing enrichment, activity ingestion/cards, and inline transactions.
- Author/listing diversity caps and production-scale background indexing.
- Gallery service ownership, 2D gallery views, and Studio integration.
- Production branding/navigation pruning, bundle reduction, and domain cutover.

Keep the auctionhouse production deployment on MVP while developing this app.
