# MVP route and operational parity inventory

**Status:** Living cutover checklist  
**Updated:** 2026-09-08  
**Source app:** `apps/mvp` at `cryptoart.social`  
**Destination:** `apps/social` public surface, `apps/studio` artist and paid-media surface

This inventory is gate 1 in
[`CUTOVER_AND_DURABILITY_PLAN.md`](./CUTOVER_AND_DURABILITY_PLAN.md).
Every production MVP route, API, cron, webhook, and admin function is marked
**port**, **redirect**, **retire**, or **keep-on-mvp** until Social or Studio
owns it. “Safe to replace cryptoart.social” means there are no unmarked rows.

Legend:

- **port** — rebuild in Social or Studio; do not copy Next/React trees into the Vite client
- **redirect** — preserve the URL, send humans to the new canonical path
- **retire** — drop on cutover, with a reason
- **keep-on-mvp** — still authoritative in production; Social may read it over HTTP
- **done** — implemented in the destination app in this branch

Auction writes are on-chain. MVP HTTP is the current read/cache/admin plane.

---

## Public pages

| Path | Purpose | Decision | Destination | Notes |
|---|---|---|---|---|
| `/` | Homepage / teaser / miniapp embeds | port | Social feed | Social `/` is the Farcaster feed today |
| `/home` | Legacy homepage | retire | — | Redirect `/home` → `/` at cutover |
| `/market` | Browse listings | **done** | Social `/market` | Curated exhibition + preview; still reads MVP browse API |
| `/market/all` | Exhaustive inventory | **done** | Social `/market/all` | |
| `/create` | Create listing | **port / in progress** | Social `/create` | Studio keeps advanced auction later |
| `/listing/[id]` | Canonical Base listing | **port / in progress** | Social `/listing/base/:id` | Also keep unprefixed `/listing/:id` as Base |
| `/listing/base/[id]` | Explicit Base listing | **port / in progress** | Social | Preserve URL |
| `/listing/eth/[id]` | Ethereum listing | **port / in progress** | Social | Preserve URL |
| `/auction/[id]` | Legacy auction URL | redirect | Social `/listing/…` | Resolve chain from subgraph, then redirect |
| `/user/[username]` | Public profile | port | Social | After SIWE + FID join |
| `/profile` | Connected profile | port | Social | |
| `/settings` | Notification prefs | port | Social | After sessions |
| `/notifications` | Inbox | keep-on-mvp | Social later | Cron + Neynar tokens still MVP |
| `/membership` | STP membership | keep-on-mvp | Social later | |
| `/curate` | My galleries | port | Social admin/curator | Replaced by scoped curator galleries + exhibitions |
| `/curate/[id]` | Edit gallery | port | Social | |
| `/user/[username]/gallery/[slug]` | Public gallery | port | Social `/exhibitions/:slug` plus profile galleries | Dual URL until exhibitions absorb galleries |
| `/user/[username]/gallery/id/[id]` | Public gallery by UUID | redirect | slug URL | |
| `/gallery/[address]/[slug]` | Legacy gallery | redirect | `/user/…/gallery/…` | Already a redirect in MVP |
| `/galleries` | Internal directory | retire | Social `/admin/curators` | noindex today |
| `/maintenance` | Maintenance page | port | Social | Middleware flag |
| `/redesign` | Redirect to `/` | retire | — | |
| `/test/shares` | Dev share preview | retire | — | Dev-only |
| `/share/outbid/[id]/view` | Human outbid share | keep-on-mvp | Social later | Tied to OG share routes |

---

## Share, OG, and Mini App surfaces

| Path | Purpose | Decision | Notes |
|---|---|---|---|
| `/opengraph-image` | Homepage OG | port | Social hosting still Vite; OG needs a server later |
| `/create/opengraph-image` | Create OG | port | |
| `/profile/opengraph-image` | Profile OG | port | |
| `/membership/opengraph-image` | Membership OG | keep-on-mvp | |
| `/listing/.../opengraph-image` | Listing OG | keep-on-mvp until Social has a Node host | Preserve bytes and cache keys at cutover |
| `/market/opengraph-image` | Market OG | keep-on-mvp | |
| `/user/.../gallery/.../opengraph-image` | Gallery OG | port with exhibitions | |
| `/share/auction-created/[id]` | Bot OG / human redirect | keep-on-mvp | URL stability is a cutover gate |
| `/share/bid-placed/[id]` | same | keep-on-mvp | |
| `/share/auction-won/[id]` | same | keep-on-mvp | |
| `/share/outbid/[id]` | same | keep-on-mvp | |
| `/share/being-outbid/[id]` | same | keep-on-mvp | |
| `/share/top-bid/[id]` | same | keep-on-mvp | |
| `/share/referral/[id]` | same | keep-on-mvp | |
| `/share/collector/[identifier]` | Collector embed | keep-on-mvp | |
| `/.well-known/farcaster.json` | Mini App manifest | port | Webhook URL must remain valid |
| Mini App `fc:miniapp` / `fc:frame` meta | Embed launch | port | Not Frames.js; no cast-action routes exist |

---

## Marketplace and listing APIs

| Path | Methods | Decision | Notes |
|---|---|---|---|
| `/api/auctions/active` | GET | keep-on-mvp | Social market client already reads production |
| `/api/auctions/[listingId]` | GET | keep-on-mvp | Used by Social listing detail |
| `/api/auctions/[listingId]/warm-og-cache` | POST | keep-on-mvp | Unauthenticated today; lock down when porting |
| `/api/auctions/by-seller/[address]` | GET | port | Seller management in Social |
| `/api/auctions/with-bids/[address]` | GET | port | |
| `/api/auctions/with-offers/[address]` | GET | port | |
| `/api/auctions/invalidate-cache` | POST | keep-on-mvp | **No auth** — do not copy that model |
| `/api/listings/browse` | GET | keep-on-mvp | Social `/api/cryptoart/market` proxies this |
| `/api/listings/check-token` | GET | port | Needed by Social `/create` |
| `/api/listings/live-bids` | GET | port | |
| `/api/listings/recently-concluded` | GET | port | |
| `/api/listings/[id]/page-status` | GET, POST | keep-on-mvp | POST unauthenticated; retire or authenticate |
| `/api/listings/[id]/prerender` | POST | keep-on-mvp | No auth |
| `/api/listings/[id]/purchases` | GET | port | |
| `/api/listings/[id]/refresh-metadata` | POST | port | Requires SIWE seller/admin/curator |
| `/api/featured` | GET | port | Editor marketplace selections |
| `/api/featured-sections` | GET | port | |
| `/api/homepage-layout` | GET | port | |
| `/api/homepage-spotlight` | GET | port | |
| `/api/market-layout` | GET | keep-on-mvp | |
| `/api/redesign/sections` | GET | retire | Homepage V2; Social market replaces it |
| `/api/redesign/hydration` | GET | retire | |
| `/api/revalidate-homepage` | GET | keep-on-mvp | Cron |
| `/api/eth-price` | GET | port | |
| `/api/erc1155/supply` | GET | port | |
| `/api/listing-theme` | GET | retire or port later | Membership-gated cosmetics |
| `/api/listing-theme/default` | PATCH | later | |
| `/api/listing-theme/override` | PATCH | later | |

---

## Identity, social, and media APIs

| Path | Methods | Decision | Notes |
|---|---|---|---|
| `/api/user/[identifier]` | GET | port | |
| `/api/user/[identifier]/followers` | GET | port | |
| `/api/user/[identifier]/following` | GET | port | |
| `/api/user/username/[address]` | GET | port | |
| `/api/user/notification-preferences` | GET, PATCH | keep-on-mvp | Authenticate with SIWE when ported |
| `/api/follow` | POST, DELETE, GET | port | Stop trusting client-supplied addresses |
| `/api/favorite` | POST, DELETE, GET | port | same |
| `/api/favorites/listings` | GET | port | |
| `/api/artist/[address]` | GET | port | |
| `/api/farcaster-handles/[address]` | GET | keep-on-mvp | Social already calls production |
| `/api/farcaster/verified-addresses` | GET | port | Join wallet session to FID |
| `/api/contract-creator/[address]` | GET | port | |
| `/api/contracts/cached/[address]` | GET | keep-on-mvp | |
| `/api/contracts/deployed/[address]` | GET | keep-on-mvp | Alchemy; excluded from recovery drill |
| `/api/nfts/for-owner` | GET | keep-on-mvp | Social wallet inventory uses Alchemy directly |
| `/api/users/recent-*` | GET | later | |
| `/api/users/top-buyers-sellers` | GET | later | |
| `/api/thumbnails` | GET | keep-on-mvp | Derivatives are not canonical media |
| `/api/thumbnails/[...path]` | GET | retire | Dev only |
| `/api/tokens/[address]/image` | GET | keep-on-mvp | |
| `/api/opengraph-image` | GET | keep-on-mvp | |
| `/api/opengraph-image-home-kismet` | GET | retire after Kismet residency | |
| `/api/debug/*` | GET | retire | Unauthenticated dumps |
| `/api/health` | — | **port** | Missing in MVP; deploy/docker already expect it |

---

## Curation APIs (migration source, not the target model)

| Path | Methods | Decision | Notes |
|---|---|---|---|
| `/api/curation` | GET, POST | replace | Membership-gated personal listing lists |
| `/api/curation/[id]` | GET, PATCH, DELETE | replace | `isPublished` is not an editorial slot |
| `/api/curation/[id]/items` | POST, DELETE | replace | |
| `/api/curation/slug/[slug]` | GET | replace | |
| `/api/curation/user/[identifier]` | GET | replace | |
| `/api/curation/user/.../gallery/[slug]` | GET | redirect later | |
| `/api/curation/user/.../gallery/id/[id]` | GET | redirect later | |

Target: curator directory, scoped grants, exhibition drafts/publish/unpublish, append-only audit. New APIs live under Social `/api/cryptoart/exhibitions` and `/api/cryptoart/admin`, and Studio `/api/exhibitions` / `/api/admin`.

---

## Notifications, crons, and webhooks

| Path | Schedule / method | Decision | Notes |
|---|---|---|---|
| `/api/notifications` | GET, POST | keep-on-mvp | POST is unauthenticated |
| `/api/notifications/create` | POST | keep-on-mvp | No auth; fix when porting |
| `/api/notifications/[id]/read` | POST | keep-on-mvp | |
| `/api/notifications/unread-count` | GET | keep-on-mvp | |
| `/api/notifications/preferences` | GET, POST | keep-on-mvp | |
| `/api/notifications/global-settings` | GET | keep-on-mvp | |
| `/api/cron/notifications` | `*/1 * * * *` | keep-on-mvp | Requires `CRON_SECRET` if set |
| `/api/cron/featured-refresh` | hourly | keep-on-mvp | |
| `/api/cron/calculate-stats` | daily | keep-on-mvp | |
| `/api/cron/listing-previews` | every 4h | keep-on-mvp | |
| `/api/cron/cleanup-cache` | 02:00 | keep-on-mvp | |
| `/api/cron/refresh-homepage-og` | 01:00 | keep-on-mvp | |
| `/api/cron/refresh-market-layout` | `*/20` | keep-on-mvp | |
| `/api/revalidate-homepage` | `*/15` | keep-on-mvp | |
| `/api/webhook` | POST | keep-on-mvp | Farcaster Mini App; Neynar-verified |
| `/api/webhook/neynar` | POST | keep-on-mvp | Weaker verification; do not copy |
| Docs-only `/api/cron/artist-profiles` | — | retire | Never implemented |
| Docs-only `/api/cron/taste-compute` | — | retire | Never implemented |

Cutover cannot drop crons or the Mini App webhook until Social has a durable host. The Vite middleware is local-only.

---

## Admin pages and APIs

Current auth is **not acceptable to copy**: client-supplied `adminAddress` compared to an env allowlist, no signature. On-chain marketplace `isAdmin` is separate and only used for cancel.

| Path | Decision | Replacement |
|---|---|---|
| `/admin` → featured | replace | Social `/admin` with SIWE roles |
| `/admin/featured` | port | Editor marketplace selections |
| `/admin/featured-sections` | port | Editor |
| `/admin/marketplace` | port | Editor |
| `/admin/listings` | port | Admin operational view |
| `/admin/users` | port | Admin hide/unhide |
| `/admin/membership` | keep-on-mvp | STP revoke |
| `/admin/stats` | later | |
| `/admin/errors` | later | |
| `/admin/notifications` | keep-on-mvp | |
| `/api/admin/*` | replace | SIWE + `owner`/`admin`/`editor`/`curator` |
| `/api/admin/listings` | replace | Currently **no auth** |
| `/api/admin/backfill-contracts` | keep-on-mvp | `ADMIN_SECRET` |
| Admin FAB / context cancel | port | On-chain admin cancel stays a contract check |

First Social admin surfaces in this branch: curator directory and exhibition publishing.

---

## Auction lifecycle (on-chain, ABI in `@cryptoart/marketplace`)

| Action | Contract | MVP | Social target |
|---|---|---|---|
| Create | `createListing` | `/create` | `/create` |
| Bid | `bid` | listing UI | listing UI |
| Buy | `purchase` | listing UI | listing UI |
| Cancel | `cancel(listingId, holdbackBPS)` | seller + on-chain admin | same |
| Conclude | display-only after `endTime` | listing UI | listing UI |
| Settle | `finalize` | listing UI | listing UI |
| Recover | not implemented | — | pending/replace/speed-up states on the listing page |
| Offer / accept / modify | `offer`, `accept`, `modifyListing` | listing UI | follow-on; not required for the first lifecycle |

Read path stays the MVP subgraph APIs until a shared read package exists.

---

## Auth replacement

| Current MVP | Replacement |
|---|---|
| Env wallet/FID allowlist | Documented onchain owner/multisig bootstraps `owner` |
| `verifyAdmin(adminAddress)` | Server-verified SIWE session cookie |
| Membership NFT as “curator” | Independent curator grants: feed weight, gallery, homepage publish |
| No audit trail | Append-only `audit_events` |

Roles: **owner**, **admin**, **editor**, **curator**.

---

## Missing destination packages (this branch)

| Package | Role |
|---|---|
| `@cryptoart/identity` | SIWE, sessions, roles, audit, exhibitions |
| `@cryptoart/marketplace` | Addresses, ABI, listing lifecycle helpers |
| `@cryptoart/media` | x402 quote/payment envelope and Arweave job state machine |

`@cryptoart/db` gains session, grant, audit, exhibition, and upload-job tables.

---

## Explicitly out of the first Social cutover

- Vercel Blob / IPFS thumbnail caches as canonical storage
- Alchemy NFT index as a recovery source
- Copying MVP admin APIs that trust a posted wallet address
- Frames.js cast actions (none exist)
- LSSVM pool management (Studio later)
- Collection mint wizards (blocked on the paid Arweave proof)
