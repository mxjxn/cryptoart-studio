# Feed Curation & Quality Spec

> **Status**: Draft — Design document for review before implementation
> **Depends on**: [timeline-feed-spec.md](./timeline-feed-spec.md)
> **Date**: 2026-05-11

## Overview

The timeline feed requires curation to be useful. Without it, the feed is noise — listing spam, low-effort casts, irrelevant content. This spec defines how content enters the feed, how it's ranked, how spam is suppressed, and how artist profiles are built from on-chain activity.

## Core Philosophy

The feed is not a firehose. It is a curated space where *quality signals* determine visibility. On-chain activity is the ground truth — you can't fake a purchase. Social activity is weighted by the reputation of the speaker. Curation is a human function, not a pure algorithm.

---

## Trust Tiers

Every address on the platform has a trust tier. The tier determines:
- Whether their **casts** appear in the feed
- Whether their **listings** appear in the feed
- Their **boost weight** when they interact with content (boosting, favoriting, curating)

### Tier Definitions

| Tier | Label | Criteria | Cast Visibility | Listing Visibility |
|------|-------|----------|----------------|-------------------|
| 0 | `UNVERIFIED` | No on-chain activity on cryptoart.social | Hidden | Suppressed (rate-limited) |
| 1 | `LISTED` | Has at least one active or past listing on the platform | Hidden | Visible (rate-limited) |
| 2 | `SOLD` | Has at least one completed purchase or sale on the platform | Visible to followers | Visible |
| 3 | `COLLECTOR` | Has purchased 3+ pieces on the platform | Visible (boosted) | Visible |
| 4 | `ARTIST` | Verified creator of a listed collection (contract deployer or Manifold creator) | Visible (boosted) | Visible |
| 5 | `CURATOR` | Manually promoted by platform admins | Visible (high boost) | Visible |

### Tier Computation

Tiers are computed from on-chain data (subgraph) + platform data (Postgres). They are NOT self-assigned.

```
Tier = max(
  fromPurchases(address),    // Tiers 1-3 from buying behavior
  fromListings(address),     // Tiers 1-2 from selling behavior
  fromCollection(address),   // Tier 4 from being a contract creator
  fromManual(address)        // Tier 5 from admin assignment
)
```

**Storage:** Computed tier stored in `userCache` table (add `trustTier` column). Recomputed:
- On every purchase or listing event (via notification worker)
- On contract deployer detection (via creator-core-indexer)
- On manual admin promotion/demotion

### Tier Behavior Details

**Tier 0 (UNVERIFIED):**
- Casts about art do NOT appear in the feed
- Listings are rate-limited: max 3 visible in the feed per 24 hours
- Their on-chain events (bids, purchases) still appear if they interact with Tier 2+ listings
- This prevents random Farcaster accounts from polluting the feed

**Tier 1 (LISTED):**
- Casts still hidden (listing alone doesn't prove taste)
- Listings visible but rate-limited: max 5 per 24 hours
- If an artist lists 50 editions at once, only 5 appear in the feed. The rest are accessible via direct link or browse page, but not in the timeline.

**Tier 2+ (SOLD and above):**
- Casts visible to followers
- Tier 3+ (COLLECTOR): casts visible to all users in the feed
- No listing rate limit

**Tier 5 (CURATOR):**
- Manual assignment only (by you or delegated admins)
- Can boost/suppress other users' content
- High boost weight for their own casts and gallery events
- This is the editorial layer

---

## Listing Spam Suppression

### The Problem

On day one, the homepage was flooded by users listing dozens of editions at once. This drowns out quality content and makes the platform look like a firehose of low-effort listings.

### Solution: Per-Address Listing Throttle

When multiple listings from the same address appear in a feed window, they are grouped and collapsed.

**Rules:**

1. **Rate limit by tier** (see above): Tier 0 = max 3 per 24h, Tier 1 = max 5 per 24h, Tier 2+ = unlimited
2. **Grouping**: When an address has N listings exceeding the rate limit in a time window, show only the top N. The rest are collapsed into a summary:
   - `"ArtistName listed 47 more editions"` — expandable, but not individually rendered in the feed
3. **Deduplication of similar listings**: If the same token contract has multiple active listings at similar prices, consider them as a single "collection available" event rather than individual items.

### Spam Signals (Downrank, Not Delete)

These signals don't hide content entirely — they reduce its feed ranking:

| Signal | Effect |
|--------|--------|
| Same address lists 10+ items within 1 hour | All listings from this address in this window are grouped |
| Listing price is significantly below market average (possible wash trade or error) | Reduced visibility, flagged for curator review |
| New address (no history) lists high-value items with no prior activity | Flagged, not suppressed (could be legitimate) |
| Listing is cancelled and re-listed multiple times | Subsequent re-listings from same address on same token are grouped |

### Admin Override

Curators (Tier 5) can:
- **Pin** a specific listing to override suppression (e.g., "this 50-edition drop is actually important")
- **Shadow suppress** a listing or address (hidden from feed, no notification to the lister)
- **Mark as spam** — persistent suppress for repeat offenders (stored in Postgres)

---

## Artist Profiling

### The Problem

Not all artists are equal. An artist who has sold 20 pieces at auction is a different signal than an artist who listed once and nothing happened. The feed should reflect this.

### Solution: Artist Profile Cards

Built from on-chain data (subgraph) and surfaced in the timeline and on artist pages.

**Profile Data (all from subgraph, no self-reporting):**

```
ArtistProfile {
  address: string
  displayName: string          // From userCache (Farcaster/ENS)
  avatar: string               // From userCache
  
  // Sales history
  totalSales: number           // Number of completed purchases
  totalVolume: string          // Total ETH sold (sum of purchase amounts)
  uniqueCollectors: number     // Distinct buyer addresses
  averageSalePrice: string     // Total volume / total sales
  
  // Auction performance
  auctionsCompleted: number
  auctionsWithBids: number     // How many auctions actually got bids
  bidRate: number              // auctionsWithBids / total auctions listed
  
  // Collector loyalty
  repeatCollectors: number     // Collectors who bought 2+ pieces
  topCollector: { address, count, volume }  // Biggest single collector
  
  // Activity recency
  firstListedAt: number        // First listing timestamp
  lastListedAt: number         // Most recent listing timestamp
  lastSoldAt: number           // Most recent sale timestamp
  activeDays: number           // Days between first and last activity
  
  // Computed metrics
  velocity: number             // totalSales / activeDays (sales per day)
  collectorRetention: number   // repeatCollectors / uniqueCollectors
}
```

### How This Feeds Into the Timeline

**Artist event boost:**
- Events from artists with high `totalVolume` get a visibility boost
- Events from artists with high `collectorRetention` get a boost (repeat buyers = quality signal)
- Events from artists with low `bidRate` get no penalty (new artists deserve exposure) but no boost either

**"Artist to watch" signal:**
- New artist (first sale within last 30 days) + high sale price + positive bid activity → surfaced as a notable event
- This is editorial — "this artist just had their first sale and it went well" is interesting content

**Artist comparison context:**
- When showing a bid event, optionally show the artist's profile summary: "X's 5th sale, 3 unique collectors, Ξ12 total volume"
- This gives collectors context without requiring them to visit the artist's page

### Storage

Artist profiles are computed from subgraph data and cached in Postgres:

**New table: `artist_profiles`**

| Column | Type | Description |
|--------|------|-------------|
| `address` | text PK | Artist ETH address |
| `total_sales` | integer | Completed purchases |
| `total_volume` | text | Total ETH sold (precision-safe string) |
| `unique_collectors` | integer | Distinct buyer addresses |
| `average_sale_price` | text | Average ETH per sale |
| `auctions_completed` | integer | Completed auctions |
| `auctions_with_bids` | integer | Auctions that received bids |
| `repeat_collectors` | integer | Collectors who bought 2+ pieces |
| `first_listed_at` | timestamp | First activity |
| `last_sold_at` | timestamp | Most recent sale |
| `computed_at` | timestamp | Last computation time |

Recomputed periodically via cron job (`/api/cron/artist-profiles`). Triggered by the same notification worker that watches for new purchases.

---

## Curation as Signal

### Gallery Curation

Galleries already exist in the platform (`curation` and `curationItems` tables). Building a gallery is a curation act — the curator selected specific works and arranged them. This is a stronger signal than a cast.

**How gallery activity feeds the timeline:**

| Event | Signal | Feed Treatment |
|-------|--------|---------------|
| Curator creates a gallery | This person has taste and is willing to publicize it | `GALLERY_CREATED` event, visible to followers |
| Curator adds a piece to a gallery | This specific artwork is worth highlighting | `GALLERY_ITEM_ADDED` event, boosts the listing's visibility |
| Purchase through a gallery referral | The curator's taste led to a sale | `PURCHASE` event with gallery context: "Sold via [Gallery Name]" |

**Gallery curator boost:**

When a Tier 5 curator adds a piece to their gallery, that piece gets a temporary visibility boost in the feed. This is how curation drives discovery — the curator is saying "look at this" and the feed respects that signal.

The boost decays over time (24-48 hours) so the feed doesn't permanently favor gallery items.

### Curator Actions on the Feed

Tier 5 curators can perform these actions on timeline events:

| Action | Effect | Stored Where |
|--------|--------|-------------|
| **Boost** | Event appears higher in feed, shown to more users | New table: `feed_boosts` |
| **Suppress** | Event hidden from feed (not deleted from Farcaster) | New table: `feed_suppressions` |
| **Pin** | Event pinned to top of feed for all users (time-limited, e.g., 24h) | New table: `feed_pins` |
| **Feature** | Event added to homepage featured sections (existing system) | Existing `featuredSections` |

**New tables:**

```sql
-- feed_boosts: curator-boosted events
feed_boosts {
  id, curator_address, event_id, boost_weight (default 1), created_at, expires_at
}

-- feed_suppressions: curator-suppressed events
feed_suppressions {
  id, curator_address, event_id, reason, created_at, expires_at (nullable = permanent)
}

-- feed_pins: pinned events
feed_pins {
  id, curator_address, event_id, pinned_until, created_at
}
```

---

## Feed Ranking Algorithm

When personalization is enabled (`for` parameter), events are ranked by a composite score:

```
FeedScore = baseScore + trustBoost + curatorBoost + recencyBoost - spamPenalty

baseScore:     1.0 for all events
trustBoost:    actor.trustTier * 0.2              // Tier 5 = +1.0, Tier 0 = 0
curatorBoost:  sum(active_boosts for this event)  // From feed_boosts table
recencyBoost:  decay_function(hours_since_event)  // Recent events score higher
spamPenalty:   spam_signals * 0.5                 // Deducted for spam indicators
```

**When personalization is NOT enabled** (new user, no `for` param):

```
FeedScore = baseScore + trustBoost + curatorBoost + recencyBoost - spamPenalty
           + curationBoost

curationBoost: events in a curated gallery get +0.3
```

The ranking is applied **after** fetching and **before** pagination. It does not change the chronological order of events — it filters which events make the cut at all. Events below a threshold score are excluded from the response.

**Important:** The feed remains primarily chronological within the visible set. Ranking determines *inclusion*, not *order*. This keeps the feed feeling like a timeline rather than a recommendation engine.

---

## Default Feed (New User Experience)

A user who just installed the app and hasn't followed anyone or connected a wallet sees:

1. **Curator-pinned content** (if any pins are active)
2. **On-chain events from Tier 3+ actors** (collectors and above)
3. **Gallery events** from Tier 5 curators
4. **New listing events** from Tier 4 (verified artists) — rate-limited
5. **"Artists to watch"** — new artists with recent first sales

This is a quality-first default. No random Farcaster posts. No Tier 0 listing spam. Just activity from people who have proven something on the platform.

---

## Implementation Order

### Phase 1: Trust Tiers + Spam Suppression
1. Add `trustTier` column to `userCache`
2. Compute tiers from subgraph data (purchases, listings, collections)
3. Apply rate limits to listing events in `/api/feed` based on tier
4. Implement listing grouping for addresses that exceed rate limits
5. Add admin UI for manual tier assignment (Tier 5 curator promotion)

### Phase 2: Artist Profiles
1. Create `artist_profiles` table in Postgres
2. Build cron job to compute profiles from subgraph data
3. Include profile summary in timeline event metadata
4. Surface "artist to watch" signal for new artists with first sale

### Phase 3: Curator Actions
1. Create `feed_boosts`, `feed_suppressions`, `feed_pins` tables
2. Build curator action API endpoints (boost, suppress, pin)
3. Integrate curator actions into feed ranking algorithm
4. Add curator UI in admin panel

### Phase 4: Feed Ranking
1. Implement `FeedScore` computation
2. Apply score threshold to filter events before pagination
3. Add curator boost decay (time-limited boosts expire)
4. Test with real feed data and tune thresholds

### Phase 5: Curation Signals
1. Gallery creation/addition events as feed items
2. Gallery referral context on purchase events
3. Temporary visibility boost for gallery-added items
4. Gallery curator trust integration

---

## Open Questions

1. **Curator selection**: Who are the first Tier 5 curators beyond you? Specific collectors whose taste you trust, or artists with strong curatorial instincts? How do you decide?

2. **Tier transparency**: Should users be able to see their own trust tier? Should it be public? A collector might want to know they're Tier 3. An artist might be motivated to reach Tier 4. But it could also feel gamified in a way that doesn't fit the art world.

3. **Spam threshold tuning**: The rate limits (3/5 per 24h) are guesses. Need real data to calibrate. Should these be configurable by admins without a deploy?

4. **Artist profile visibility**: Should artist profiles be public pages, or just internal data that surfaces in the feed? A public "artist leaderboard" by volume could drive competitive listing behavior — is that good or bad for the culture?

5. **Curator accountability**: If a curator suppresses content, is that visible to anyone? Should the platform be transparent about moderation, or should curation feel seamless/invisible?
