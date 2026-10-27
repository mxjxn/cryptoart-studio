# Platform roadmap (post–VPS cutover)

North star: a fun platform where **artists maintain a following and release art**, and the **community curates galleries/collections** with commentary and presentation. Curators who help a sale earn a cut via the existing **auctionhouse** contracts.

## Locked sequence

| Order | Milestone | Notes |
|------:|-----------|-------|
| 0 | **Hostinger VPS** serving today's `apps/mvp` | [VPS_CUTOVER.md](./VPS_CUTOVER.md). Keep Supabase Postgres; move blob to R2. |
| 1 | **Hypersnap social** | Resume `feat/social-web-foundation`. Vite client + identity packages. Hub RPC via Hypersnap team nodes. Do **not** copy the Next tree into Social. |
| 2 | **Studio minting** | `apps/studio` — deploy collection, mint, manage. Arweave paid by artist. |
| 3 | **Lazy mint** | Contracts support it; never productized. Gate before extra markets. |
| 4 | **LSSVM pools** | [such-lssvm](https://github.com/mxjxn/such-lssvm) / [LSSVM_INTEGRATION.md](./LSSVM_INTEGRATION.md). Continuous buy/sell beside auctions. |
| 5 | **STP memberships** | [stp-v2](https://github.com/mxjxn/stp-v2) — paid follow / subscription, not a listing type. |

## Day-one commerce (and what waits)

- **In:** Auctionhouse listings only. Curator % already exists on-chain when attribution is wired through a gallery.
- **Out until lazy mint:** LSSVM UI, STP UI, replacing auctionhouse.

## Galleries / curator cuts

Curation tables and APIs already exist under `apps/mvp` (`curation`, `curation_items`). Remaining product work:

- Commentary + presentation polish
- **Sale attribution** so auctionhouse curator bps fire when the buy came through a gallery

Do that on the auctionhouse path; do not wait for LSSVM.

## Explicit non-goals until VPS is live

- Merging `feat/social-web-foundation` into production cutover
- Self-hosting Postgres “to leave Supabase”
- Shipping LSSVM or STP UI
- Replacing auctionhouse with a new marketplace

## Parked branch

`feat/social-web-foundation` stays parked until `cryptoart.social` is stable on the VPS. Documented here so agents do not reopen Social/Studio cutover work mid–lift-and-shift.
