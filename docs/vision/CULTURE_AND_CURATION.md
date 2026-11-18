# Culture, curation, and the Social feed

This document captures Max’s product vision for **cryptoart.social** as culture-first collection—not speculation—and maps that vision to work on the **relaunch branch** (`cursor/cloud-agent-1793668111647-jftwu`, PR [#198](https://github.com/mxjxn/cryptoart-studio/pull/198)). It is a planning artifact only; it does not change runtime behavior.

**Product update (Nov 18, 2026):** “Subnet” means **our Hypersnap channel**, not the global network. The default home view is **channel-first**; browsing outside the channel is **opt-in**. Curation algorithms are **transparent and user-selectable** (named “AI curators”).

**Release waves (Nov 18, 2026):** **First wave (relaunch)** — existing **MVP `curation` galleries** and **referral fees** as-is; **no gallery channel links**. **Second wave** — **gallery channels** after **Hypersnap ships its own channel product** (expected to mirror Farcaster’s channel API with **free** creation).

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

### Gallery channels (second wave — after Hypersnap channels)

**Deferred until Hypersnap ships channel creation.** Max expects Hypersnap to **mirror the Farcaster channel API** and make channels **free**, so we **do not** build app-owned `parent_url` gallery channels on relaunch.

**Why we still want this:** A gallery-as-channel **psychologically gives curators ownership**—they **lead** a gallery others visit and discuss **inside** that room, not only a static listing grid plus a generic URL.

**First wave:** Curators use **MVP database galleries** (listings, slug, **`referralAddress`**) and share **gallery page links** into the **`cryptoart`** home channel. **No per-gallery channel ids or conversation column** at relaunch.

**Second wave:** When Hypersnap’s channel solution is live, each published gallery can bind to a **real channel** (works + in-channel conversation on one surface). See **Second wave: after Hypersnap channels** below.

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
| Gallery + referral | MVP galleries + `referralAddress` | Relaunch: **no channel link** on galleries |
| Gallery channels | **Second wave** (wait for Hypersnap) | Not in first wave scope |
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

### Phase 2 — Gallery casts and curator commentary (M) — **first wave**

Boosts use **channel-active** likers on the **home** channel. Galleries remain **MVP curation pages** only—**no gallery channel binding**.

| Task | Repo touchpoints |
| --- | --- |
| Parse gallery URLs; gallery-link flag; time-window boost | `gallery-links.ts`, `ranking.ts` |
| Compose “Share gallery” template (link to MVP gallery URL only) | `ComposePage.tsx` |
| Gallery strip on cards | `Feed.tsx` |
| Referral preservation tests | MVP `PublicGalleryClient.tsx`, Social |

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

---

## Hypersnap channels — research background (Nov 18, 2026)

*Background for second wave. **Not** actionable for relaunch; informs why we wait for Hypersnap’s channel product.*

Sources: [Hypersnap introduction](https://hypersnap.org/docs/introduction), [Channels read API](https://hypersnap.org/docs/reference/reads/channels), [Feeds read API](https://hypersnap.org/docs/reference/reads/feeds), [FIP: Channels on Snapchain](https://github.com/farcasterxyz/protocol/discussions/276), [Quilcast `channels.mjs`](https://github.com/backmeupplz/quilcast/blob/main/server/channels.mjs) (how clients cope today). Live checks on `https://haatz.quilibrium.com`.

### What Hypersnap exposes *today* (read path)

| Capability | API | Notes |
| --- | --- | --- |
| Channel lookup / feed | `GET /v2/farcaster/channel`, `/feed/channels`, `/feed/parent_urls` | Feeds are **parent-url scoped** casts ([Feeds doc](https://hypersnap.org/docs/reference/reads/feeds)) |
| HTTP channel writes | `POST …/channel/*` | **`501 Not Implemented`** — same as casts: use gRPC `SubmitMessage` ([Channels doc](https://hypersnap.org/docs/reference/reads/channels)) |

### Max’s read on “channels” on Hypersnap *now*

On the node, **channels are effectively FIP‑2 / legacy `parent_url` grouping**, not full Farcaster client channels:

- **Channel ids** are inferred from cast `parent_url` values—typically `https://warpcast.com/~/channel/<id>` or `https://farcaster.xyz/~/channel/<id>`, and for older channels a **`chain://…/erc721:…/`** parent resolved via on-chain **`name()`** (see Quilcast comment: Hypersnap’s list is “made up from casts' parent URLs”, with **no** authoritative names, images, or member counts on-node).
- **No channel metadata, ownership, or moderation** is served from the Hypersnap index alone for arbitrary parents—unlike Warpcast’s directory.
- **Clients bridge the gap:** [Quilcast](https://github.com/backmeupplz/quilcast/blob/main/server/channels.mjs) caches **`GET https://api.farcaster.xyz/v2/all-channels`** for titles, images, follower counts, and a legacy `parent_url → id` map when URLs are not the standard `…/~/channel/<id>` form.

**Decision:** Do **not** ship Cryptoart-owned `parent_url` gallery namespaces on relaunch. Wait for **Hypersnap’s forthcoming channel API** (expected to mirror Farcaster, **free** creation per Max) before binding galleries to channels.

### Direction (FIP-276)

FIP-276 describes **on-chain channel keys** plus signed **`ChannelUpdate` / moderation** messages ([discussion #276](https://github.com/farcasterxyz/protocol/discussions/276)). Hypersnap is expected to align with that **and** with familiar Farcaster v2 HTTP shapes when channel **creation** lands—**second wave** integration point.

---

## First wave vs second wave — galleries

### First wave (relaunch)

| Object | Role |
| --- | --- |
| **MVP `curation` gallery** | Listings, order, slug, publish, **`referralAddress`** on listing CTAs — **unchanged** |
| **Social feed** | Curators share **gallery page URLs** into **`cryptoart`**; no `channel_id` on gallery rows |
| **Social `exhibitions`** | Editorial rail only |

### Second wave: after Hypersnap channels

**Trigger:** Hypersnap documents **user/channel creation** (free), with metadata + ownership + moderation comparable to Farcaster.

**Goal:** One **published gallery** ↔ one **Hypersnap channel** the curator **leads**; gallery page = **works grid** (MVP curation) + **channel conversation** (`feed/channels` or successor API).

| Task | Repo touchpoints |
| --- | --- |
| DB: `hypersnap_channel_id` (or key) on `curation` when gallery is published | `packages/db`, MVP publish API |
| Create/link channel via **Hypersnap channel API** when curator publishes (not app-invented `parent_url`) | new integration service |
| Gallery page v2: works + conversation column | Social or unified gallery route |
| Compose in gallery channel; promote casts to `cryptoart` home | `compose.ts` |
| Rollup: gallery-channel activity → home AI curator weights (per recipe) | `ranking.ts`, active-member job |

*Deferred design (do not build on relaunch):* app-owned `https://cryptoart.social/~/gallery/...` **parent URLs**, custom moderation, or paid registrar keys per gallery.

**Why still worth it:** Channels give curators a **psychological home**—a named room they host—while commerce stays on MVP curation + referral fees.

### Fit with home channel + AI curators (second wave)

| Surface | Scope |
| --- | --- |
| **`/` home** | **`cryptoart`** channel + user-selected AI curator |
| **Gallery page** | Works (MVP) + casts in **gallery’s Hypersnap channel** |
| **Promotion** | Cross-post / gallery-link casts on home; rollup rules in curator docs |

---

## Open questions for Max

1. **Channel key confirmation:** Ship with `cryptoart` only, or also surface sibling channels (`gen-art`, `gifart`, … from `APPROVED_CHANNELS`) inside “browse outside”?

2. **Gallery boost window:** How long should a gallery-link cast stay boosted after the first active-member like?

3. **Freshness vs quality:** Is **2 popular : 1 latest** within the channel enough, or require a minimum **arrivals quota** per screen?

4. **Participatory tags:** Open vocabulary, controlled taxonomy, or both? Who mints new tags at launch?

5. **Points economics:** Public reputation, private score, or both? Any link to fees?

6. **Downvotes:** Permanently off, or only after an exposure window?

7. **Gallery limit vs culture:** Does MVP **3-gallery / membership** gating still fit when **second wave** adds one channel per gallery?

8. **Compose identity:** App-held gasless signer vs user-signed casts?

9. **such.market timing:** When to show a disabled “Propose trade” CTA?

10. **Price on feed cards:** Hide list price on conversation cards for all curators, or only for Community Activity / Conversation?

11. **Cross-app deployment:** Single domain for Social desk + MVP galleries at relaunch?

12. **Curator default:** Is **Community Activity** the default for everyone, or do we run a short **opt-in A/B** once metrics exist (Phase 2+)?

**Deferred (second wave — gallery channels):** parent URL format, registration cost/subsidy, moderation defaults, home rollup for gallery-channel likes—revisit when Hypersnap’s channel API ships.

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
- Client channel directory pattern: [Quilcast `channels.mjs`](https://github.com/backmeupplz/quilcast/blob/main/server/channels.mjs), `api.farcaster.xyz/v2/all-channels`