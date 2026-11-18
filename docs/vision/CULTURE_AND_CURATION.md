# Culture, curation, and the Social feed

This document captures Max’s product vision for **cryptoart.social** as culture-first collection—not speculation—and maps that vision to work on the **relaunch branch** (`cursor/cloud-agent-1793668111647-jftwu`, PR [#198](https://github.com/mxjxn/cryptoart-studio/pull/198)). It is a planning artifact only; it does not change runtime behavior.

---

## Vision (Max’s words, organized)

### Mission: excitement about collecting

The mission is to get people excited about **collecting**, not just selling. Buying is the hard part. **Curation is the bridge** between passive browsing and becoming a collector.

We are not building another floor-price dashboard. We are building a place where work is admired, argued about, and gathered into a personal collection.

### Curators on the feed

Curators share **gallery links**—the marketplace’s **referral-fee gallery** feature—with the feed, adding their own commentary about the collection. A gallery cast is not a bare link drop; it is taste plus context.

When someone buys through that thread, the curator’s wallet is already wired as **`referralAddress`** on listings surfaced from their gallery, and the auction house contract pays **`referrerBPS`** on settlement.

### Ranking: community-weighted curation, not raw popularity

A gallery-link cast should rank **higher for a bounded time window** when it is liked by users who are **active in our Hypersnap subnet**—engagement from active community members should matter more than raw like counts from drive-by accounts.

That boost is **time-limited** so the feed stays alive; it complements—not replaces—fresh work.

### Fresh art always has a path

**Fresh art is always interlaced** into the feed. Do not hide new or low-quality work. Everyone gets a chance to be seen **before** anyone can downvote them. Discovery is participation, not elimination.

### Participatory art (beyond swipe)

This is not swipe-left / swipe-right curation. Users **tag, categorize, and write** about works. Contributors earn **reputation or points** for categorizing; they earn more when others agree with their tags or when works they surfaced **sell**.

### Do not financialize fandom

**Membership tokens and artworks are not presented as speculation vessels.** In this app they are assets in your collection to be admired and envied. No price-chart or flip-centric UI in the collection experience.

### Collector tools (in-app and coming)

Collectors need to **browse collected works in-app**, set a quick **list price** to put a piece in the auction house, and—later—**Seaport-based trade proposals from the wallet** when **such.market** ships. Trade proposals are explicitly out of scope for the first Social cut but must stay visible in the roadmap so engineering does not paint us into a “list or hold forever” corner.

---

## Current implementation snapshot (relaunch branch)

See the companion review in the PR that introduces this file. At a high level:

| Area | Today | Gap vs vision |
| --- | --- | --- |
| Three-column desk | **Shipped** in `apps/social/web/src/cryptoart/Feed.tsx` (Activity · Conversation · Create) | Mobile still collapses rails; center cards are read-only |
| Feed sources | Hypersnap HTTP on **haatz** (`/feed/trending`, `/feed?fid=`) | No gallery-specific ingest; no persistent reaction sync |
| Ranking | `ranking.ts` interlaces popular/latest; `weightedLikes` is a **static FID map** | No subnet activity; no gallery-link detector; `activeListingBoost` unused in build path |
| Gallery + referral | **MVP** `curation` galleries, `referralAddress` on shares and gallery listing cards | Social feed does not parse gallery URLs or boost curator casts |
| Likes / reactions | Counts displayed; no in-app actions | Full Farcaster reaction UI remains from fork; cryptoart cards don’t wire actions |
| Tags / points | — | Not started |
| Collector browse | `YourItems.tsx` + `/api/cryptoart/assets/*` | Not linked from main header; no quick list-from-wallet in Social |
| Compose | Gated `/compose`; Snapchain submit scaffold | Curators cannot yet publish gallery commentary to Hypersnap from Social |

---

## Phased work breakdown (rough size)

Sizes are **engineering weeks for one focused builder**, order-of-magnitude only. Tasks name concrete touchpoints in this repo.

### Phase 0 — Feed honesty and instrumentation (S)

**Goal:** Measure what we have before changing rank.

| Task | Repo touchpoints |
| --- | --- |
| Document feed snapshot contract (`cursor`, 60s refresh / 10m retain) | `apps/social/web/src/cryptoart/server.ts` |
| Log gallery URLs and listing refs per cast at normalize time | `neynar.ts`, `listing-links.ts` (+ extend parser for `/user/.../gallery/...`) |
| Admin view of `FEED_POLICY` and curator FID weights | `policy.ts`, `/admin/curators` |
| Vitest fixtures for gallery URL parsing | `ranking.test.ts`, new `gallery-links.test.ts` |

### Phase 1 — Subnet-weighted likes (M)

**Goal:** Replace the hardcoded `weightedLikes: { 4905: 20 }` with a maintained **active member set**.

| Task | Repo touchpoints |
| --- | --- |
| **Active member definition (v1)** — see “What active in our subnet can mean” below | New table e.g. `feed_member_scores` in `packages/db`, nightly job in indexer or cron |
| Hydrate liker FIDs from Hypersnap cast payloads (full liker list or paginated reactions API if available) | `server.ts` `build()` — today only counts likers already in `CURATOR_FIDS` |
| Score: `curation += weight(fid)` for active members only; cap per cast and time decay | `ranking.ts`, `policy.ts` |
| Sybil resistance: require linked wallet **or** marketplace touch **or** membership NFT; rate-limit new FIDs | `packages/identity`, MVP membership contract checks |
| Expose “why ranked” debug for admins | Optional `/admin/feed-debug?hash=` API |

**Anti-gaming notes:** Never trust `viewer_context.liked` from the provider for rank; never use abbreviated liker samples without verification (already tested in `ranking.test.ts`). Weight **sales attributed to surfaced work** in Phase 3, not in Phase 1.

### Phase 2 — Gallery casts and curator commentary (M)

**Goal:** Curators publish gallery links + essay; feed recognizes and boosts them within the window.

| Task | Repo touchpoints |
| --- | --- |
| Parse `cryptoart.social/user/.../gallery/...` in cast text/embeds | `listing-links.ts` or `gallery-links.ts` |
| Verify gallery exists and resolve curator address | MVP `/api/curation/*` or shared read API (`docs/SUCH_GALLERY_READ_API_PLAN.md`) |
| Gallery-link cast flag on `Candidate`; boost when active-member likes present | `ranking.ts`, `normalizeCast` |
| Compose template: “Share gallery” with pre-filled URL + SIWE curator check | `ComposePage.tsx`, `compose.ts` (after write path live) |
| Card UI: show gallery thumbnail strip, not only first image embed | `Feed.tsx` `PostCard` |
| Ensure shared gallery listing links preserve `referralAddress=curator` | Already in `PublicGalleryClient.tsx`; add tests + Social link builder |

### Phase 3 — Participatory metadata and reputation (L)

**Goal:** Tags, categories, short essays; points with agreement and sale attribution.

| Task | Repo touchpoints |
| --- | --- |
| Data model: `work_tags`, `tag_votes`, `tag_agreements`, `contributor_points` | `packages/db` migrations |
| Indexer: attribute sales to listing → token → tags / surfacing cast hash | `packages/marketplace` indexer, `referral` on bid tuple |
| UI: tag editor on listing/artwork pages; feed show top tags | Social artwork routes (planned), MVP listing pages |
| Points ledger API; anti-farming (dedupe votes, cooldown, minimum account age) | New service; audit via `audit_events` pattern |
| No downvote before exposure window | Policy: min time in “arrivals” lane before negative signal (if any) |

### Phase 4 — Collection-first surfaces (M–L)

**Goal:** Collecting UX without flip charts; quick list; such.market placeholder.

| Task | Repo touchpoints |
| --- | --- |
| “My collection” in header → `YourItems` / wallet inventory | `CryptoartHeader.tsx`, routes |
| Quick **list price** from owned token → Studio or MVP create listing handoff | `studio` list flow, `ListTokenForm.tsx`, Social bridge |
| De-emphasize price history in collection views; emphasize media + provenance | Social + MVP listing components |
| Document + stub **Seaport / such.market** trade proposal entry (disabled CTA) | `docs/MARKET_GESTURES_AND_GALLERY_MODEL.md`, future `such.market` app |
| Membership STP as access, not ticker | MVP membership pages; avoid APY-style copy |

### Phase 5 — Hypersnap write path and reactions (M, parallel)

**Goal:** Close the loop: read rank → publish → like from clients that write to Snapchain.

| Task | Repo touchpoints |
| --- | --- |
| Gasless signer + `POST /v1/submitMessage` on haatz | `compose.ts`, `snapchainSubmit.ts`, env `SNAPCHAIN_SUBMIT_URL` |
| Cast adds with embeds (gallery URL, listing URL) | `compose.ts`, composer protobuf helpers |
| Reaction writes (likes) or delegate to wallet signer | Optionally trim imported FC composer vs minimal like button |
| Read-back polling until cast appears in trending/following | `server.ts` |

---

## What “active in our Hypersnap subnet” can mean (using data we actually have)

We do **not** yet have a canonical “subnet active” bitmap. These are **implementable v1 signals** from this monorepo and haatz today:

1. **Hypersnap-linked identity** — `packages/identity/src/farcasterDirectory.ts` resolves `address → fid` via `HYPERSNAP_FARCASTER_URL` (`user/bulk-by-address`). Active set: FIDs that appear in directory with a verified custody address **and** have been seen in feed pulls in the last *N* days (requires storing author FIDs from `createFeedService.build`).

2. **Wallet session / SIWE on Social** — `wallet_sessions` and role grants (`packages/db` `role_grants`). Active: addresses with a non-revoked session in the last *N* days.

3. **Marketplace participation** — Indexer / subgraph: bidders, buyers, sellers in the last *N* days; map to FID via directory. Strong signal for “collectors who actually buy.”

4. **Membership NFT (STP v2)** — MVP membership gating already checks balance for gallery creation. Active: FIDs linked to wallets holding membership (culture-aligned but smaller set).

5. **Curator capability grants** — `role_grants.capability` includes feed weight / gallery / exhibition flags (see schema comment at `role_grants`). Active curators are a **subset**, not the whole subnet—use for editorial multiplier, not general activity.

6. **Reaction graph from Hypersnap** — When cast payloads include `reactions.likes[]`, we can count how often a FID liked in the last *N* days (rolling counter table). This is the closest on-chain-adjacent signal to “engaged in our network” without inventing a new social graph.

**Recommended v1 rule (proposal):** Mark a FID **active** if `(directory-linked wallet AND (marketplace event OR ≥3 likes cast in 14d)) OR membership OR curator grant`. Recompute daily; store in Postgres; feed rank reads a frozen snapshot per feed build.

**Not available today:** channel-based subnet membership (channels are explicitly **not** feed gates), Neynar-only engagement scores, or write-side confirmation that a liker is “in subnet” until we ingest likes ourselves.

---

## Open questions for Max

1. **Active member set:** Which v1 rule above should be canonical? What window *N* (7 vs 14 vs 30 days)? Should marketplace-only wallets count without any Hypersnap like activity?

2. **Gallery boost window:** How long should a gallery-link cast stay in the “curated boost” band after the first active-member like—hours, days, until engagement stalls?

3. **Freshness vs quality:** Current rank interlaces 2 popular : 1 latest. Is that enough “everyone gets seen,” or do we need a dedicated **arrivals quota** (e.g. minimum 1-in-5 slots for first-time authors)?

4. **Participatory tags:** Open vocabulary, controlled taxonomy, or both? Who can create new tags—anyone or curators only at first?

5. **Points economics:** Should points be visible public reputation, private curator score, or both? Any conversion to fees/referrals, or strictly non-financial?

6. **Downvotes:** Vision says no downvote before exposure—is **negative signal** permanently off the table, or only delayed / soft-hidden?

7. **Gallery limit vs culture:** MVP enforces membership gating and historical **3-gallery** product; does that still match “many curators sharing collections on the feed”?

8. **Exhibitions vs MVP galleries:** Social has `exhibitions` tables and such-gallery editorial slots; MVP has `curation` galleries with referral. Which is the **primary** curator object for feed sharing?

9. **Compose identity:** App-held gasless signer vs user-signed casts—which matches trust model for curator commentary?

10. **such.market timing:** When should Social show a disabled “Propose trade” CTA so collectors know it’s planned?

11. **Price display on feed:** Listing embeds show amounts on Market/Activity rail; should **conversation cards** hide price until click to honor “do not financialize fandom”?

12. **Cross-app deployment:** Social feed APIs are in the Vite desk; galleries and referral settlement live on MVP—single domain routing vs split deploy for relaunch?

---

## References (code and plans)

- Feed desk: `apps/social/web/src/cryptoart/Feed.tsx`, `Shell.tsx`
- Rank policy: `apps/social/web/src/cryptoart/ranking.ts`, `policy.ts`, `exhibition.ts`
- Hypersnap reads: `apps/social/web/src/cryptoart/server.ts`
- Hypersnap write: `docs/plans/2026-11-12-hypersnap-write-path.md`
- Layout IA: `docs/plans/2026-11-02-social-first-layout.md`
- Gallery referral (MVP): `apps/mvp/src/components/ShareButton.tsx`, `PublicGalleryClient.tsx`
- Marketplace referrer: `packages/marketplace/src/abi.ts` (`referrerBPS`, bid `referrer`)