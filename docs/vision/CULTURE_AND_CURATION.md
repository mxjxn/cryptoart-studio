# Culture, curation, and the Social feed

This document captures Max’s product vision for **cryptoart.social** as culture-first collection—not speculation—and maps that vision to work on the **relaunch branch** (`cursor/cloud-agent-1793668111647-jftwu`, PR [#198](https://github.com/mxjxn/cryptoart-studio/pull/198)). It is a planning artifact only; it does not change runtime behavior.

**Product update (Nov 18, 2026):** “Subnet” means **our Hypersnap channel**, not the global network. The default home view is **channel-first**; browsing outside the channel is **opt-in**. Curation algorithms are **transparent and user-selectable** (named “AI curators”).

---

## Vision (Max’s words, organized)

### Mission: excitement about collecting

The mission is to get people excited about **collecting**, not just selling. Buying is the hard part. **Curation is the bridge** between passive browsing and becoming a collector.

We are not building another floor-price dashboard. We are building a place where work is admired, argued about, and gathered into a personal collection.

### Our channel is home

The app primarily features content from **our own Hypersnap / Farcaster channel**. That channel is the **default home view**—not Hypersnap’s global trending feed. Users can browse outside the channel, but that is an explicit **opt-in** (“browse outside”), not the default.

**Active subnet member** means someone **active in our channel**: they cast, reply, or like within the channel on a recent window (exact activity thresholds are tunable; see below). Likes from those members are the **curation weight** that lifts gallery commentary and community picks—not raw global like counts.

> **Reverses current relaunch behavior:** Today the feed intentionally does **not** gate on channel (`ranking.test.ts`: “channel is not an admission gate”; `server.ts` pulls `/feed/trending` network-wide). Shipping Max’s direction requires a deliberate product flip and updated tests/docs.

**Configured channel id (repo):** `apps/social/web/src/cryptoart/policy.ts` sets `DEFAULT_CHANNEL = 'cryptoart'` and lists related art channels in `APPROVED_CHANNELS`. `docs/target-channels.md` treats **`/cryptoart`** as the home channel (fid 4905). Treat **`cryptoart`** as the canonical app channel key unless a deploy-time override is introduced—if Hypersnap expects a different key, confirm against hub channel metadata before launch.

### Curators on the feed

Curators share **gallery links**—the marketplace’s **referral-fee gallery** feature—with the feed, adding their own commentary about the collection. A gallery cast is not a bare link drop; it is taste plus context.

When someone buys through that thread, the curator’s wallet is already wired as **`referralAddress`** on listings surfaced from their gallery, and the auction house contract pays **`referrerBPS`** on settlement.

### Gallery channels (inexpensive galleries)

Let users create **gallery channels**: a very inexpensive way to open a gallery where **conversation and works live in one place**. Each published gallery is backed by (or *is*) a channel. Casting **in** the gallery channel makes context obvious—you are in the gallery, seeing the works while reading and posting. Curator essays, visitor comments, and the gallery’s listings share one room instead of splitting across a static page and a disconnected timeline.

This pairs with the marketplace **curation** record (listings, order, slug, referral wallet) and can later align with protocol-level channel registration if/when that is cheap enough for every curator.

### Ranking: community-weighted curation, not raw popularity

A gallery-link cast should rank **higher for a bounded time window** when it is liked by **active channel members**. Engagement from people who participate in **our channel** matters more than drive-by global likes.

That boost is **time-limited** so the feed stays alive; it complements—not replaces—fresh work.

### Transparent, public algorithms (“AI curators”)

Curation must be **fully transparent**. Users choose among a small set of **named, openly documented algorithms**—**AI curators**—each with a plain-language description and a **published scoring recipe** (readable docs in-repo, not a black box).

Users can **switch curators** and compare feeds. The UI shows **which curator ranked the current feed** and, per post, **why it appears** (factors contributed: freshness slot, channel-member like, gallery link, etc.). Over time we can add **public aggregate stats** per curator (engagement, collections attributed)—**v1 keeps the set small** and defers heavy experimentation infrastructure.

**Principles carried into every curator:**

- **Fresh art is always interlaced** (no curator may eliminate the latest/arrivals lane).
- **Do not financialize fandom**—e.g. a “good price point” curator frames **value for collectors** and accessibility, not flip potential or floor charts.

### Fresh art always has a path

**Fresh art is always interlaced** into the feed. Do not hide new or low-quality work. Everyone gets a chance to be seen **before** anyone can downvote them. Discovery is participation, not elimination.

### Participatory art (beyond swipe)

This is not swipe-left / swipe-right curation. Users **tag, categorize, and write** about works. Contributors earn **reputation or points** for categorizing; they earn more when others agree with their tags or when works they surfaced **sell**.

### Do not financialize fandom

**Membership tokens and artworks are not presented as speculation vessels.** In this app they are assets in your collection to be admired and envied. No price-chart or flip-centric UI in the collection experience.

### Collector tools (in-app and coming)

Collectors need to **browse collected works in-app**, set a quick **list price** to put a piece in the auction house, and—later—**Seaport-based trade proposals from the wallet** when **such.market** ships. Trade proposals are explicitly out of scope for the first Social cut but must stay visible in the roadmap so engineering does not paint us into a “list or hold forever” corner.

---

## AI curators — minimal v1 (proposal)

Start with **four** curators. Each is a **versioned document** (`docs/vision/curators/<slug>.md`) plus a **registered implementation** keyed by slug (same inputs: channel-scoped candidates, active-member set, marketplace indexer snapshots).

| Slug (id) | Display name | One-line intent | Scoring sketch (published recipe) |
| --- | --- | --- | --- |
| `community-activity` | **Community Activity** | Default home voice: what channel members are lifting | Channel feed only; log engagement + **member likes** + gallery-link boost; interlace **2 popular : 1 latest** inside channel; member-like weight from nightly `channel_active_fids` |
| `collector-momentum` | **Collector Momentum** | What people are actually collecting | Boost casts/listings with **verified sales** in last *N* days (indexer); still interleave fresh channel posts; copy emphasizes “collected” not “sold for profit” |
| `conversation` | **Conversation** | What the channel is talking about | Recency-weighted **likes + replies + recasts** in channel; member likes add固定 bonus; fresh interlace unchanged |
| `fair-entry` | **Fair Entry** | Work at approachable list prices | Boost channel casts linking **live listings** under a configurable ETH/USDC threshold; surface **new listings** and first-time authors; no “underpriced flip” framing |

**v1 UI (feed header):** curator picker · label “Ranked by **Community Activity**” · per-card **“Why here”** (expandable: lane, curator factors, gallery/listing detection).

**Later phases (not v1):** automatic A/B assignment, leaderboard stats per curator, user-submitted curator recipes, ML re-ranking. v1 is **manual selection + full documentation**.

---

## Current implementation snapshot (relaunch branch)

| Area | Today | Gap vs vision |
| --- | --- | --- |
| Three-column desk | **Shipped** in `apps/social/web/src/cryptoart/Feed.tsx` | Mobile rails; read-only cards |
| Feed scope | **Global** `/feed/trending` + optional following mix | Must default to **channel `cryptoart`**; opt-in global browse |
| Channel gating | **Explicitly off** (`ranking.ts`, tests) | Admission filter, compose default parent URL, browse-outside toggle |
| Ranking | Static `weightedLikes` FID map | **Channel-active FIDs** + selected **AI curator** recipe |
| Transparency | No “why ranked” or curator choice | Curator registry, docs, feed UI |
| Gallery + referral | MVP galleries + `referralAddress` | No **gallery channel** (`parent_url` feed + combined page) |
| Gallery channels | — | Not implemented |
| Likes / reactions | Display counts only | No channel-scoped member weighting |
| Tags / points | — | Not started |
| Collector browse | `YourItems.tsx` | Not in header; no quick list in Social |
| Compose | Gated write path | Posts should default to **our channel** when live |

---

## Phased work breakdown (rough size)

Sizes are **engineering weeks for one focused builder**, order-of-magnitude only.

### Phase 0 — Feed honesty and instrumentation (S)

| Task | Repo touchpoints |
| --- | --- |
| Document feed snapshot contract | `server.ts` |
| Log gallery/listing refs per cast | `neynar.ts`, `listing-links.ts`, `gallery-links.ts` (new) |
| **Publish v1 curator recipes** (markdown + JSON schema for factors) | `docs/vision/curators/*` |
| Vitest fixtures for gallery URLs | `ranking.test.ts` |

### Phase 1 — Channel-default home + active members (M)

**Goal:** Flip from global trending to **our channel** as default; define **active channel member** set; wire member likes into curation weight.

| Task | Repo touchpoints |
| --- | --- |
| Config: `HOME_CHANNEL_KEY` (default `cryptoart`) | `policy.ts`, env |
| Ingest **channel feed** from Hypersnap (verify hub path, e.g. channel feed by key) | `server.ts` — replace or gate `/feed/trending` |
| **Filter candidates** to channel unless `?scope=network` or “Browse outside” | `server.ts`, `Feed.tsx` |
| UI: **Browse outside** toggle (session or query); clear label when on global stream | `Feed.tsx`, `CryptoartHeader.tsx` |
| Table `channel_active_fids` (fid, last_cast_at, last_like_at, last_reply_at, computed_at) | `packages/db` migration |
| Job: refresh active set from channel casts + reactions (14d window initial) | indexer/cron |
| Replace `weightedLikes` static map with **active-channel-member** weight | `policy.ts`, `server.ts` `build()`, `ranking.ts` |
| **Update tests** that assert “any channel admitted” | `ranking.test.ts`, `server.test.ts` |
| Compose: default cast parent to home channel when write path ships | `compose.ts` |

### Phase 1b — Transparent AI curators (M, can overlap 1)

| Task | Repo touchpoints |
| --- | --- |
| `CuratorRegistry`: slug → scoring function + doc URL | `ranking.ts` or `curators/registry.ts` |
| Implement v1 four curators (shared interlace helper) | `ranking.ts` |
| Persist viewer’s selected curator (cookie / account) | API + `Feed.tsx` |
| **Why here** payload on each ranked item | extend rank result type, `PostCard` |
| Admin: switch default curator for experiments | `policy.ts` or DB flag |

### Phase 2 — Gallery casts and curator commentary (M)

(Unchanged intent; boosts use **channel-active** likers.)

| Task | Repo touchpoints |
| --- | --- |
| Parse gallery URLs; gallery-link flag; time-window boost | `gallery-links.ts`, `ranking.ts` |
| Compose “Share gallery” template | `ComposePage.tsx` |
| Gallery strip on cards | `Feed.tsx` |
| Referral preservation tests | MVP `PublicGalleryClient.tsx`, Social |

### Phase 2c — Gallery channels (M–L)

**Goal:** One gallery = one conversation scope on Hypersnap, cheap by default, commerce from existing MVP curation.

| Task | Repo touchpoints |
| --- | --- |
| DB: `parent_url` (and optional `protocol_channel_key`) on `curation` / gallery publish | `packages/db`, MVP publish API |
| Canonical parent URL pattern, e.g. `https://cryptoart.social/~/gallery/{username}/{slug}` | `gallery-url.ts`, Social route |
| **Gallery page v2:** works grid + live conversation column (`GET /v2/farcaster/feed/parent_urls`) | Social page (new) or extend MVP `PublicGalleryClient` via embed |
| Compose **in gallery:** default `parent_url` to gallery channel when viewing that gallery | `compose.ts`, gallery page CTA |
| Create flow: on publish gallery → allocate `parent_url` (+ optional on-chain channel later) | MVP `api/curation` |
| Promote to home: curator cross-post into `cryptoart` channel or gallery-link cast on home | Compose templates |
| **Main feed rollup:** count likes/casts in registered gallery `parent_url`s toward active-member and AI curator signals when the liker is active in `cryptoart` (policy doc + weights) | `ranking.ts`, `channel_active_fids` job |
| Moderation v1: curator FID = owner; hide via app UI until `ChannelModerate` write path exists | policy + admin |

See **Hypersnap channel research** and **Gallery channel product model** below.

### Phase 3 — Participatory metadata and reputation (L)

| Task | Repo touchpoints |
| --- | --- |
| Tags, votes, points, sale attribution | `packages/db`, indexer |
| Exposure before negative signal | policy in curator interlace rules |

### Phase 4 — Collection-first surfaces (M–L)

| Task | Repo touchpoints |
| --- | --- |
| Header → collection, quick list, such.market stub | Social + Studio |
| Price presentation rules per curator (Fair Entry vs others) | curator docs + UI |

### Phase 5 — Hypersnap write + reactions (M, parallel)

| Task | Repo touchpoints |
| --- | --- |
| Submit + channel-targeted casts | `compose.ts`, `snapchainSubmit.ts` |
| Likes from clients → refresh member activity | reaction writes + job |

---

## Active channel member (v1 definition)

**Subnet = our channel (`cryptoart` unless configured).** An **active channel member** is a FID that, within the last **14 days** (tunable constant):

1. **Cast at least once** in the home channel (author `channel.id === HOME_CHANNEL_KEY`), **or**
2. Appears in **verified like lists** on casts in that channel (same rules as ranking: no `viewer_context` shortcuts), **or**
3. **Replies** to a cast in that channel (when reply graph is available from Hypersnap).

Recompute at least daily; store in Postgres; feed build reads a **frozen snapshot** tied to the feed snapshot id.

**Sybil resistance (v1):** optional tie-break—prefer FIDs with directory-linked wallet or marketplace touch; do not exclude lurkers who only like in-channel.

**Data sources today:** Hypersnap HTTP cast payloads (`channel.id` on `NeynarCast`), `packages/identity` directory for wallet↔FID, marketplace indexer for Collector Momentum curator only.

**Gallery channels (extension):** Activity *inside* a gallery’s `parent_url` can increment per-gallery engagement and, when the actor is active in `cryptoart`, contribute to **home** curation weights (e.g. member-like boost on casts that also appear on home or that carry a gallery-link into `cryptoart`). Exact rollup is policy-tunable per AI curator recipe.

---

## Hypersnap channels — research (Nov 18, 2026)

Sources: [Hypersnap introduction](https://hypersnap.org/docs/introduction), [Channels read API](https://hypersnap.org/docs/reference/reads/channels), [Feeds read API](https://hypersnap.org/docs/reference/reads/feeds), [Build a client guide](https://hypersnap.org/docs/guides/build-a-client), [FIP: Channels on Snapchain](https://github.com/farcasterxyz/protocol/discussions/276). Live checks against public node `https://haatz.quilibrium.com` (same host named in Hypersnap docs).

### What works today on haatz (read path)

| Capability | API | Notes |
| --- | --- | --- |
| Channel profile | `GET /v2/farcaster/channel?id={key}` | e.g. `cryptoart` returns `parent_url` `https://warpcast.com/~/channel/cryptoart` ([Channels doc](https://hypersnap.org/docs/reference/reads/channels)) |
| Channel-scoped cast feed | `GET /v2/farcaster/feed/channels?channel_ids=...` | Comma-separated ids ([Feeds doc](https://hypersnap.org/docs/reference/reads/feeds)) |
| **Parent URL feed** | `GET /v2/farcaster/feed/parent_urls?parent_urls=...` | Same casts as channel id when URL matches; **does not require** a named channel registry entry ([Feeds doc](https://hypersnap.org/docs/reference/reads/feeds)) |
| Members / trending channels | `GET .../channel/members`, `.../channel/trending` | Read-only indexes on the node |

Verified on haatz: `feed/channels?channel_ids=cryptoart` and `feed/parent_urls?parent_urls=https://warpcast.com/~/channel/cryptoart` return casts with matching `parent_url`.

### What does *not* work on HTTP (write path)

Hypersnap documents that **mutations go through signed protocol messages on gRPC `SubmitMessage`**, not the HTTP `/v2/farcaster/*` surface ([introduction](https://hypersnap.org/docs/introduction); same pattern as casts in [repo write-path note](../plans/2026-11-12-hypersnap-write-path.md)).

Channel-related HTTP writes (`POST /v2/farcaster/channel/follow`, member invite, etc.) are **registered but return `501 Not Implemented`**—follow/unfollow and channel admin use signed `LinkAdd` / channel message types instead ([Channels doc](https://hypersnap.org/docs/reference/reads/channels)).

### On-chain vs off-chain (two layers)

| Layer | Today / near term | Protocol direction (FIP-276) |
| --- | --- | --- |
| **Casting into a “channel”** | Casts carry `parent_url` (and/or resolve to a channel id in indexes). Anyone can publish with a chosen parent URL via `CastAdd` + signer—**no channel owner required** to accept posts. | FIP: *“casting is not gated by channel state”*—expiry/ownership affects **administration**, not whether casts merge ([FIP §2–3](https://github.com/farcasterxyz/protocol/discussions/276)). |
| **Channel ownership & config** | Legacy: host-centric (e.g. Warpcast) DB. Hypersnap: **local registry + membership index** rebuilt from ingested messages ([Channels doc](https://hypersnap.org/docs/reference/reads/channels)). | FIP: **on-chain** Basenames-style registrar (ERC-721) for the channel **key** + **signed messages** (`ChannelUpdate`, `ChannelMember`, `ChannelModerate`, …) for description, mods, pins, hide ([FIP §1, §3](https://github.com/farcasterxyz/protocol/discussions/276)). |
| **Cost** | Posting to a `parent_url` we define: **no registry fee** (only normal cast signing). | FIP discussion cites **~$25** as today’s one-time Warpcast channel fee; proposes **renewable** registrar pricing (amount/term **open** in FIP; community feedback favors lower/default pricing) ([FIP Motivation & comments](https://github.com/farcasterxyz/protocol/discussions/276)). |
| **Moderation** | Client/backend today; Hypersnap indexes `ChannelModerate` when present. | Owner + moderators (max 10); HIDE/UNHIDE on casts; membership OPEN vs APPROVAL on protocol ([FIP §3–4](https://github.com/farcasterxyz/protocol/discussions/276)). |

### Can users create channels *right now*?

- **On Hypersnap HTTP:** no create endpoint; **501** on channel writes.
- **On Snapchain (FIP model):** creation = **pay registrar** + submit **`ChannelUpdate`** via `SubmitMessage` (not yet assumed live for every gallery on relaunch).
- **For Cryptoart gallery channels v1 (recommended):** treat each gallery as a **stable `parent_url` under our domain** (e.g. `https://cryptoart.social/~/gallery/{username}/{slug}`). Curators and visitors cast with that parent; we read with `feed/parent_urls`. **No per-gallery on-chain name required** for conversation to work. Optionally register a protocol `channel_key` later when pricing and tooling are right (or sponsor keys for featured curators).
- **Fallback if parent feeds lag:** index gallery casts ourselves from home-channel cross-posts + gallery-link detection until the node indexes our parent URLs reliably.

---

## Gallery channel product model

### Objects (how pieces link)

| Object | Role | Referral / commerce |
| --- | --- | --- |
| **MVP `curation` gallery** | Source of truth: listings, order, slug, `curatorAddress`, publish flag | Listing cards use **`referralAddress={curatorAddress}`** (`PublicGalleryClient.tsx`); on-chain **`referrerBPS`** on purchase |
| **Gallery channel** | Hypersnap conversation scope: **`parent_url`** (+ optional protocol `channel_key`) | No separate fee; commerce still via listings inside the gallery record |
| **Social `exhibitions`** | Editorial “on view” slots (Creator rail, `/exhibitions/:slug`) | Can mirror a gallery or a hand-picked set; **not** the default curator share object |

**Primary share object:** publish **gallery channel** (conversation + works). Curators promote by **casting inside the gallery** and optionally **cross-posting** to `cryptoart` home. **Exhibitions** remain marketing/editorial layers, not the default gallery.

### Gallery channel page (UX)

```
┌─────────────────────────────────────────────────────────┐
│  Gallery title · curator · referral-backed listings      │
├──────────────────────────┬──────────────────────────────┤
│  WORKS                   │  CONVERSATION               │
│  (curation items grid)   │  parent_url feed (Hypersnap) │
│  listing CTAs + ref      │  compose defaults to gallery  │
└──────────────────────────┴──────────────────────────────┘
```

Mobile: tab or stack “Works | Talk”, same data.

### Fit with home channel + AI curators

| Surface | Scope | Curator |
| --- | --- | --- |
| **`/` home** | Default: casts in **`cryptoart`** channel (opt-in browse outside) | User-selected **AI curator** (v1 recipes) |
| **`/user/.../gallery/...`** | Works from MVP curation + **conversation** for that gallery’s `parent_url` | Same picker optional; default **Conversation** scoped to parent |
| **Promotion** | Gallery activity does not replace home; **rollup** policy decides whether member likes *in gallery channels* boost **home** ranking for linked posts | Documented per recipe in `docs/vision/curators/*` |

---

## Open questions for Max

1. **Channel key confirmation:** Ship with `cryptoart` only, or also surface sibling channels (`gen-art`, `gifart`, … from `APPROVED_CHANNELS`) inside “browse outside”?

2. **Gallery boost window:** How long should a gallery-link cast stay boosted after the first active-member like?

3. **Freshness vs quality:** Is **2 popular : 1 latest** within the channel enough, or require a minimum **arrivals quota** per screen?

4. **Participatory tags:** Open vocabulary, controlled taxonomy, or both? Who mints new tags at launch?

5. **Points economics:** Public reputation, private score, or both? Any link to fees?

6. **Downvotes:** Permanently off, or only after an exposure window?

7. **Gallery limit vs culture:** Does MVP **3-gallery / membership** gating still fit **gallery channels** (one channel per gallery)?

8. **Compose identity:** App-held gasless signer vs user-signed casts?

9. **such.market timing:** When to show a disabled “Propose trade” CTA?

10. **Price on feed cards:** Hide list price on conversation cards for all curators, or only for Community Activity / Conversation?

11. **Cross-app deployment:** Single domain for Social desk + MVP galleries at relaunch?

12. **Curator default:** Is **Community Activity** the default for everyone, or do we run a short **opt-in A/B** once metrics exist (Phase 2+)?

13. **Gallery channel v1 mechanism:** **`parent_url` only** (no registry fee) vs require **FIP channel registration** per gallery when registrar pricing is known?

14. **Parent URL format:** Standardize on `cryptoart.social/~/gallery/...` vs `warpcast.com/~/channel/...` compatibility for indexes?

15. **Protocol channel keys:** If on-chain keys are adopted, who pays registration (curator, app subsidy, membership perk)?

16. **Gallery channel moderation:** Curator-only v1, or appoint moderators via future `ChannelMember` messages?

17. **Home rollup detail:** Should **all** gallery-channel member likes count toward home boosts, or only when the cast is also cross-posted / linked on `cryptoart`?

---

## References (code and plans)

- Channel config: `apps/social/web/src/cryptoart/policy.ts` (`DEFAULT_CHANNEL`, `APPROVED_CHANNELS`)
- Home channel research: `docs/target-channels.md`
- Feed desk: `apps/social/web/src/cryptoart/Feed.tsx`, `Shell.tsx`
- Rank policy (today): `ranking.ts`, `server.ts` (global trending)
- Prior global-feed decision: `docs/plans/2026-11-02-social-first-layout.md` (superseded on channel default per this doc)
- Gallery referral (MVP): `ShareButton.tsx`, `PublicGalleryClient.tsx`
- Marketplace referrer: `packages/marketplace/src/abi.ts`
- Hypersnap channels: [reads/channels](https://hypersnap.org/docs/reference/reads/channels), [reads/feeds](https://hypersnap.org/docs/reference/reads/feeds), [FIP-276](https://github.com/farcasterxyz/protocol/discussions/276)
- Channel feed (haatz): `GET /v2/farcaster/feed/channels`, `GET /v2/farcaster/feed/parent_urls`