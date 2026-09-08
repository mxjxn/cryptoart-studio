# Cryptoart Platform Roadmap

**Status:** Active product and architecture direction  
**Updated:** 2026-09-07

## Product direction

Cryptoart is becoming one connected platform with two public surfaces:

- **cryptoart.social** is the public destination for exhibitions, social discovery,
  collecting, bidding, buying, selling, galleries, and lightweight auction creation.
- **cryptoart.studio** is the artist workspace for collection deployment, minting,
  token management, advanced auction setup, and liquidity management.

`apps/social` will replace the production `apps/mvp` application at
cryptoart.social. The replacement will be incremental: working marketplace APIs
and transaction paths remain available while their reusable logic is extracted.

Related systems retain their own responsibilities:

- `apps/mvp`: current production marketplace and temporary migration source.
- `apps/studio`: artist operations and collection management.
- `such-gallery-elixir`: gallery records, artwork placements, curation, and
  optional real-time gallery capabilities.
- `such-lssvm`: NFT liquidity-pool contracts, subgraph, quotes, and pool trading.
- Auctionhouse contracts and subgraph: auctions, fixed-price listings, bids,
  purchases, and settlement state.

## Experience ownership

| Capability | Social | Studio | Shared service or protocol |
| --- | --- | --- | --- |
| Curated exhibitions | Primary public view | Curator management later | such.gallery |
| Farcaster feed and conversations | Primary | Contextual sharing only | Neynar/Farcaster |
| Browse marketplace inventory | Primary | Owned work only | Auctionhouse read model |
| Bid, buy, and sell | Primary | Available in management flows | Auctionhouse contracts |
| Quick auction creation | Yes | Yes | Shared transaction workflow |
| Advanced auction management | Link to Studio | Primary | Shared transaction workflow |
| Collection deployment and minting | Link to Studio | Primary | Creator Core |
| Lazy mint configuration | Discovery and purchase | Primary creation surface | Shared lazy-mint protocol |
| Pool discovery and swaps | Primary | Owned pool overview | LSSVM |
| Pool creation and liquidity management | Link to Studio | Primary | LSSVM |

## Market information architecture

`/market` is a curated entrance, not an exhaustive listing grid.

1. **Current exhibition** — a manually selected such.gallery exhibition rendered
   as a fast, native 2D experience.
2. **More exhibitions** — additional manually curated galleries. A later ranking
   source may add trending galleries without changing the gallery model.
3. **Your items** — wallet-owned NFTs with actions to cast, discuss, list, add to
   a gallery, or open in Studio.
4. **Marketplace selections** — current auctions, editions, lazy mints, and
   liquidity pools presented with distinct visual systems.

Supporting routes:

- `/market/all` — exhaustive inventory, filters, and sorting.
- `/exhibitions/:slug` — native 2D exhibition view.
- `/artwork/:chain/:contract/:tokenId` — canonical artwork and discussion page.
- `/listing/:chain/:id` — transaction-specific listing page.

An artwork does not need to be for sale to appear in an exhibition or discussion.
Commerce state is attached to the artwork when available.

## Shared platform boundaries

Do not move entire UI components between the Next.js applications and the
Farcaster-derived Vite application. Extract stable domain contracts and services:

- `@cryptoart/marketplace`: normalized commerce types, lifecycle rules, chain
  paths, read clients, and transaction preparation.
- `@cryptoart/media`: IPFS and Arweave normalization, cached derivatives, and
  fallbacks.
- `@cryptoart/identity`: wallet, ENS, Farcaster, and artist identity resolution.
- `@cryptoart/activity`: normalized listed, bid, outbid, sold, minted, and swap
  events for feeds and notifications.
- `@cryptoart/contracts`: ABIs, deployments, and typed contract helpers.
- `@cryptoart/ui`: brand primitives and selected transaction-state components.

The source protocols and indexers remain authoritative. A platform read model may
combine their data for fast page rendering, search, ranking, and activity feeds.

## Media and read performance

Decentralized source media must not block marketplace rendering.

1. Preserve the canonical IPFS or Arweave URI.
2. Resolve and validate metadata asynchronously.
3. Produce bounded WebP/AVIF derivatives and store them under stable keys in R2.
4. Return cached artwork and marketplace records immediately.
5. Refresh mutable auction and pool state independently in the background.
6. Invalidate transaction-sensitive records after confirmed writes and indexer
   updates.
7. Keep stale known-good data available during gateway, RPC, or subgraph failure.

## Delivery roadmap

### Phase 0 — Foundation already in progress

- [x] Port the Farcaster web client into `apps/social`.
- [x] Restrict discovery to the initial approved channels.
- [x] Add curator-weighted feed ranking and popular/latest interlacing.
- [x] Add marketplace activity cards and explicit auction/sale examples.
- [x] Render Farcaster Mini Apps.
- [x] Add a graph-backed latest-listings section.
- [x] Establish the Cryptoart visual identity and exhibition hierarchy.

**Exit:** Social provides a credible public read experience at local development.

### Phase 1 — Market discovery in Social

- [ ] Define normalized `Artwork`, `Commerce`, and `Exhibition` contracts.
- [ ] Build `/market` with a curated exhibition and a cached marketplace preview.
- [ ] Build `/market/all` with pagination, filters, and stable URLs.
- [ ] Add “Your items” progressive wallet inventory loading.
- [ ] Add cast, discuss, list, gallery, and Studio actions to owned items.
- [ ] Treat auction, fixed-price edition, lazy mint, and pool cards distinctly.

**Exit:** A visitor can discover curated work and browse the complete existing
marketplace without returning to the MVP interface.

### Phase 2 — Collector transaction journey

- [ ] Port canonical artwork and listing detail routes.
- [ ] Port wallet connection, chain switching, bids, buys, and settlement.
- [ ] Generate feed activities from indexed marketplace events.
- [ ] Attach verified live commerce state to artwork casts.
- [ ] Replace explicit listing 5/6 placements with curator-managed placements.
- [ ] Preserve transaction recovery, explorer links, and actionable errors.

**Exit:** Existing auctionhouse listings can be discovered and completed entirely
within Social.

### Phase 3 — Gallery integration

- [ ] Specify a versioned read API between Social and such.gallery.
- [ ] Import gallery, artwork-placement, artwork, and curatorial-copy records.
- [ ] Build native `/exhibitions/:slug` 2D presentations.
- [ ] Add gallery-level sharing and discussion.
- [ ] Add “Add to gallery” for owned work.
- [ ] Add editorial publication controls for the `/market` exhibition slots.
- [ ] Defer live chat, presence, and embedded 3D until the 2D experience is stable.

**Exit:** Manually curated such.gallery exhibitions publish reliably on Social.

### Phase 4 — Cryptoart-owned identity and creation

- [ ] Replace the imported proprietary login/sync-channel flow.
- [ ] Join wallet identity, Farcaster identity, and posting authorization.
- [ ] Enable authenticated reactions, comments, casts, blocks, and mutes.
- [ ] Build a shared auction transaction workflow.
- [ ] Expose quick auction creation in Social and the complete flow in Studio.

**Exit:** Users can participate socially and create auctions through supported,
Cryptoart-owned authentication and transaction paths.

### Phase 5 — Studio deployment and artist workflow

- [ ] Deploy cryptoart.studio with production configuration.
- [ ] Complete collection deployment, minting, and token management.
- [ ] Share identity, media, contract, and marketplace modules with Social.
- [ ] Add contextual round trips between artwork pages and Studio management.
- [ ] Add lazy-mint creation and lifecycle management in Studio.
- [ ] Render lazy-mint discovery and purchase experiences in Social.

**Exit:** Artists can create and administer work in Studio, then publish and sell
it through Social without duplicate data entry.

### Phase 6 — LSSVM liquidity

- [ ] Consume the `@mxjxn/lssvm-abis` package and deployment registry.
- [ ] Integrate the LSSVM subgraph into the platform read model.
- [ ] Add pool discovery, inventory, quotes, buys, sells, and swap activity to
  Social.
- [ ] Add pool creation, deposits, withdrawals, and advanced settings to Studio.
- [ ] Preserve royalty, fee, slippage, and curve information through confirmation.
- [ ] Reuse the existing such-lssvm Mini App where it improves cast interactions.

**Exit:** LSSVM pools are a first-class commerce type across Social and Studio.

### Phase 7 — Production cutover

- [ ] Inventory all MVP public routes, APIs, cron jobs, webhooks, and admin tools.
- [ ] Migrate or explicitly retire each item with route-level parity tracking.
- [ ] Move background ingestion and caches behind stable platform services.
- [ ] Add redirects and preserve listing/share URLs and social previews.
- [ ] Run a read-only shadow period against production data.
- [ ] Cut cryptoart.social to `apps/social` with rollback capability.
- [ ] Retire `apps/mvp` only after transaction, webhook, cache, and admin parity.

**Exit:** Social is the production application and MVP has no unique operational
responsibility.

### Phase 8 — Ranking and real-time gallery expansion

- [ ] Add trending-gallery signals after manual publishing is reliable.
- [ ] Add more weighted curators and transparent ranking controls.
- [ ] Add personalized taste signals with diversity and anti-spam constraints.
- [ ] Evaluate bringing such.gallery presence, chat, and 3D rooms back into the
  connected experience.

## Near-term implementation sequence

Work should begin with Phase 1 in this order:

1. Write normalized cross-source domain types.
2. Add the `/market` and `/market/all` route shells to Social.
3. Move the existing latest-listings adapter behind the normalized read client.
4. Port the MVP browse behavior and caching semantics.
5. Build the curated exhibition slot against a fixture matching the such.gallery
   contract, then connect its read API.
6. Add wallet-owned inventory progressively, with cached media first.

This sequence produces visible product progress while establishing the seams needed
for later Studio, gallery, and LSSVM work.

## Decisions still to make

- Where the combined read model runs and which database owns its derived records.
- Whether such.gallery remains independently deployed or shares platform database
  access through an API boundary. An API boundary is the current recommendation.
- The canonical artwork identifier across EVM chains and future non-EVM sources.
- Which wallet and Farcaster authentication provider becomes the platform session.
- The initial supported chains for lazy minting and LSSVM liquidity.
- Who can publish a gallery into editorial exhibition slots and how publication is
  audited.

These decisions should be recorded here when made so app-specific plans do not
silently diverge.
