# Taste Signals Specification

**Status:** Draft
**Depends on:** [minting-spec.md](./minting-spec.md), [channel-feed-spec.md](./channel-feed-spec.md), existing `favorites` table
**Relates to:** [feed-curation-spec.md](./feed-curation-spec.md)

---

## Overview

Build a taste graph from implicit actions — no explicit ratings, no stars, no forms. Every signal comes from behavior people are already doing: favoriting artwork, purchasing, and following. The taste system runs silently in the background, surfacing better artwork in the feed over time without anyone thinking about it.

### Core Principle

**Favoriting is following.** When someone favorites a listing, they're saying "I want to know what happens with this." The immediate value is notifications — did it sell? Did the price change? Did someone bid? The taste vector is a byproduct, not the purpose.

---

## 1. Signal Sources

### 1.1 Favorites (Strongest Behavioral Signal)

**What exists:** `favorites` table with `userAddress`, `listingId`, `createdAt`. API at `POST /api/favorite` and `GET /api/favorites/listings`.

**What it becomes:** Each favorite is a positive signal across the favorited artwork's tag dimensions. The user never fills out tags — the artwork's tags (from [minting-spec.md](./minting-spec.md) metadata) define the dimensions.

**Signal weight:** 1.0 per favorite. This is the baseline unit.

### 1.2 Purchases (Strongest Signal)

**What exists:** Subgraph indexes `Purchase` events with `buyer`, `listingId`, `price`, `chainId`.

**What it becomes:** A purchase is the ultimate endorsement. Weighted at 5.0x a favorite. Buying says more than saving.

**Implementation:** Query subgraph for purchases by address. Cross-reference listing metadata for tags. Add to taste vector at purchase weight.

### 1.3 View Without Favorite (Weak Negative Signal)

**What it means:** User saw the artwork in the feed (impression tracked) and didn't favorite it.

**Signal weight:** -0.1 per impression without favorite. Weak enough to not penalize a single miss, but meaningful at scale. A user who sees 100 generative works and only saves 3 has a weaker generative signal than someone who sees 10 and saves 3.

**Implementation:** Feed impressions logged to `feed_impressions` table. Batch-processed to update taste vectors nightly, not in real-time.

### 1.4 Follows (Artist-Level Signal)

**What exists:** `follows` table with `followerAddress`, `followingAddress`, `createdAt`.

**What it becomes:** Following an artist creates a positive bias toward that artist's typical tag profile. If you follow a generative artist, your "generative" dimension gets a small boost even before you favorite specific works.

**Signal weight:** 0.3 per follow, distributed across the artist's average tag profile.

### 1.5 Time Decay

All signals decay over time. Recent favorites matter more than old ones.

```
weight = base_weight × e^(-λ × age_in_days)
```

Where `λ = 0.003` (half-life of ~231 days). This means:
- 30 days old: 0.91x weight
- 90 days old: 0.76x weight
- 180 days old: 0.58x weight
- 365 days old: 0.33x weight

Old taste doesn't disappear — it fades. If someone was into photography two years ago but now only saves generative work, the generative signal dominates naturally.

---

## 2. Taste Vector Model

### 2.1 Structure

Each user has a **taste vector** — a sparse map of tag → weighted score.

```
User taste vector example:
{
  "generative": 8.4,
  "dark": 5.2,
  "abstract": 4.1,
  "glitch": 3.7,
  "animated": 2.0,
  "photography": -0.3,   // viewed but rarely saved
  "figurative": -0.1
}
```

Tags with zero signal don't appear in the vector. Most users will have 10-30 active dimensions out of ~50 possible root tags.

### 2.2 Vector Computation

**Nightly batch job** (not real-time). Runs as a cron worker, similar to existing `/api/cron/notifications`.

```
For each user with activity in the last 90 days:
  1. Fetch all favorites (with listing metadata → tags)
  2. Fetch all purchases from subgraph (with listing metadata → tags)
  3. Fetch all follows (with followed artist's average tag profile)
  4. Fetch feed impressions without favorites (weak negative)
  5. For each tag touched:
     - Sum weighted signals (favorite × 1.0, purchase × 5.0, follow × 0.3, no-fav × -0.1)
     - Apply time decay to each signal before summing
  6. Write updated taste vector to user_taste_vectors table
```

### 2.3 New User Bootstrap

New users have no taste vector. Options for cold start:

- **No personalization:** show the default channel feed (chronological, trust-tier-filtered). This is the zero-state.
- **Farcaster profile mining:** if the user has a Farcaster account, their casts and reactions provide initial taste signal. Expensive to compute, defer to phase 2.
- **Onboarding picks:** show 20 diverse artworks across tag dimensions, ask user to save any that appeal. First 5 saves give a rough initial vector. Defer to phase 2.

For phase 1: no personalization. The channel feed with trust tiers is the default experience. Personalization kicks in once a user has favorited 5+ works.

---

## 3. Dimensional Authority

### 3.1 Concept

Not all opinions carry equal weight in all dimensions. A user who consistently favorites generative work and whose favorites correlate with what gets purchased has high authority in the "generative" dimension. Their generative favorites influence feed ranking more than a casual browser's.

### 3.2 Authority Score Per Dimension

For each tag dimension, compute a user's authority score:

```
authority[tag] = correlation(user's favorites in tag, actual purchases in tag)
               × volume(user's favorites in tag)
               × recency_factor
```

**Components:**

- **Correlation:** if a user favorites 10 generative works and 7 of them get purchased, their correlation is 0.7. High correlation = good taste in this dimension.
- **Volume:** a user who has favorited 50 generative works has more signal than one who favorited 3. But volume alone isn't enough — need correlation too. `sqrt(favorite_count)` to avoid dominance by power users.
- **Recency:** authority decays like taste signals. If you stopped being active in a dimension, your authority fades.

### 3.3 Authority Tiers

Rather than a continuous authority score, bucket users into tiers per dimension for simpler implementation:

| Tier | Name | Correlation | Volume | Feed Influence |
|------|------|-------------|--------|----------------|
| 0 | Inactive | — | < 3 favorites | 1.0x (baseline) |
| 1 | Browser | < 0.3 | 3-10 | 1.2x |
| 2 | Collector | 0.3-0.6 | 10-30 | 1.5x |
| 3 | Curator | 0.6-0.8 | 30+ | 2.0x |
| 4 | Expert | > 0.8 | 30+ | 3.0x |

These tiers are **per-dimension**, not global. A user can be Tier 4 in "generative" and Tier 1 in "photography."

### 3.4 Gaming Resistance

- **Volume floor:** need minimum 3 favorites in a dimension before authority kicks in. Prevents single-favorite spam.
- **Correlation requirement:** raw volume without correlation caps at Tier 1. You can't game authority by mass-favoriting everything.
- **Decay:** inactive users lose authority. Sybil attacks require sustained effort.
- **No visible authority scores:** authority is backend-only. Users don't see their tier. This prevents gaming-for-status and keeps the focus on the art.

---

## 4. Feed Integration

### 4.1 Ranking Boost

When the channel feed ([channel-feed-spec.md](./channel-feed-spec.md)) renders a listing, the taste system provides an optional ranking boost:

```
feed_score = base_chronological_position
           + taste_alignment_score(viewer, listing)
           + authority_weighted_popularity(listing)
```

**taste_alignment_score:** dot product of viewer's taste vector and listing's tag vector. Higher alignment = higher boost. Only applied when viewer has a taste vector (5+ favorites).

**authority_weighted_popularity:** sum of `(authority[favorite_author][tag] × 1.0)` across all users who favorited this listing. A listing favorited by Tier 4 "generative" curators scores higher than one favorited only by Tier 0 browsers.

### 4.2 "Trending Among Similar Collectors" Surface

When a listing has high authority-weighted popularity in dimensions that match the viewer's taste, it gets a subtle signal in the feed:

> "Popular with collectors who follow [tag1], [tag2]"

This is the only user-facing exposure of the taste system. It never names individuals or shows scores — just aggregate directional signals.

### 4.3 No Filter Bubble

Taste-based ranking is a **boost**, not a filter. All channel content remains visible regardless of taste alignment. The taste system just reorders within the trust-tier-filtered set. Users still see work outside their established taste — it just ranks lower.

---

## 5. Notification Integration

Favorites already serve as artwork-level notification subscriptions. The existing notification infrastructure extends naturally:

### 5.1 New Notification Triggers

When a user favorites a listing, they opt into updates about that specific artwork:

```typescript
type NotificationType =
  | 'LISTING_CREATED'
  | 'NEW_BID'
  | 'BUY_NOW_SALE'
  // ... existing types
  | 'FAVORITE_LISTING_SOLD'        // artwork you favorited was purchased
  | 'FAVORITE_LISTING_BID'         // new bid on artwork you're watching
  | 'FAVORITE_LISTING_PRICE_DROP'  // price reduced on artwork you're watching (if/when supported)
  | 'FAVORITE_ARTIST_NEW_LISTING'  // artist whose work you favorited listed something new
```

### 5.2 Notification Preferences

Users should be able to control notification frequency per type:

- **Every event** (default for new favorites): push for every bid, sale, price change
- **Digest** (opt-in): daily summary of activity across all favorited artworks
- **Muted**: no notifications, but favorite still contributes to taste vector

This is a UI concern but worth noting: if someone mutes notifications, their favorites still build taste signal. The signal and the notification are separate systems.

---

## 6. Database Schema

### 6.1 User Taste Vectors

```
user_taste_vectors
├── id (serial, PK)
├── user_address (text, not null, unique) — wallet address
├── vector (jsonb, not null) — { "generative": 8.4, "dark": 5.2, ... }
├── total_favorites (integer, default 0) — for authority volume calculation
├── total_purchases (integer, default 0)
├── computed_at (timestamp, not null) — last computation time
└── version (integer, default 1) — for incremental updates
```

### 6.2 Dimensional Authority

```
user_authority
├── id (serial, PK)
├── user_address (text, not null)
├── tag (text, not null)
├── tier (integer, default 0) — 0-4
├── correlation (float) — correlation between their favorites and purchases in this tag
├── volume (integer) — number of favorites in this tag
├── computed_at (timestamp, not null)
└── UNIQUE(user_address, tag)
```

### 6.3 Feed Impressions (for weak negative signal)

```
feed_impressions
├── id (serial, PK)
├── user_address (text, not null)
├── listing_id (text, not null)
├── impression_count (integer, default 1) — increment if seen multiple times
├── first_seen_at (timestamp, not null)
├── last_seen_at (timestamp, not null)
└── UNIQUE(user_address, listing_id)
```

### 6.4 Extension to Existing `favorites` Table

The `favorites` table needs no schema changes. It already has `userAddress`, `listingId`, `createdAt`. The taste computation reads from it directly and joins with listing metadata for tags.

---

## 7. Taste Computation Worker

### 7.1 Cron Job

```
POST /api/cron/taste-compute
  Runs: daily at 03:00 UTC
  Timeout: 10 minutes
```

### 7.2 Algorithm

```
1. Query all users with favorites in the last 90 days
2. For each user:
   a. Load their favorites (join with lazy_listings/marketplace listings for tags)
   b. Load their purchases from subgraph (cross-chain)
   c. Load their follows (join with followed artist's tag profile)
   d. Load impressions without favorites (last 30 days only, older data too noisy)
   e. For each tag:
      - Sum: (favorites × 1.0 + purchases × 5.0 + follows × 0.3 - no_favs × 0.1)
      - Apply time decay per signal
   f. Write taste vector to user_taste_vectors
3. Recompute authority scores:
   a. For each tag dimension:
      - For each user with favorites in that tag:
        - Calculate correlation: fraction of their favorited works in this tag that were purchased by anyone
        - Calculate volume: count of their favorites in this tag
        - Assign tier based on correlation + volume thresholds
      - Write to user_authority
4. Log computation stats: users processed, vectors updated, time taken
```

### 7.3 Performance Considerations

- **Batch size:** process 500 users per batch, paginate through active users
- **Tag source:** tags come from listing metadata (stored in `lazy_listings` for lazy-minted work, from subgraph or a `listing_tags` table for standard listings)
- **Subgraph queries:** batch purchase queries by buyer address, not per-user. Cache results for the computation window.
- **Incremental updates:** on days with low activity, only recompute vectors for users who favorited/purchased since last run. Check `favorites.createdAt > last computed_at`.

---

## 8. Implementation Phases

### Phase 1: Favorites as Notifications (no taste math)

- Extend existing favorites API to trigger artwork-level notifications
- `FAVORITE_LISTING_SOLD` and `FAVORITE_LISTING_BID` notification types
- Notification preferences: every event / digest / muted
- "Watching" language in UI (not "favorited" — you're watching what happens)
- This is the user-facing value that justifies the interaction

### Phase 2: Taste Vectors

- Tag vocabulary: curated root tags (~50) deployed
- Tags stored alongside listings (standard and lazy-minted)
- Nightly taste computation worker
- `user_taste_vectors` table populated
- Feed ranking boost based on taste alignment (opt-in behind feature flag)
- Minimum 5 favorites before personalization activates

### Phase 3: Dimensional Authority

- `user_authority` table computed nightly
- Authority-weighted popularity in feed ranking
- "Popular with collectors who follow [tags]" surface signal
- Authority tiers influence ranking but remain invisible to users

### Phase 4: Advanced

- Feed impressions tracking for weak negative signals
- Cold start: onboarding artwork picks for initial vector
- Cross-user taste similarity (people like you also liked...) — not collaborative filtering recommendations, just directional signals
- Artist tag profiles computed from their body of work
- Taste vector export/import (if user switches wallets)

---

## Open Questions

1. **"Watching" vs "Favoriting" in UI:** rename existing favorites to "watching"? Or keep "favorites" as the public action and "watching" as the notification subscription? They're the same action currently.
2. **Public vs private favorites:** are a user's watched listings visible to others? If public, it's a social signal (like a cast). If private, it's pure taste data. Both have merit.
3. **Tag source for standard (non-lazy) listings:** lazy-minted works have tags in metadata. Standard listings minted through Manifold may not have tags. How do we tag existing listings? Manual curation? AI-generated tags from images? Artist retrospective tagging?
4. **Taste vector for non-authenticated users:** Farcaster-only users without wallets can't have a taste vector based on purchases. Favorites are address-based. Do we need FID-based favorites for non-wallet users?
5. **Authority gaming via coordinated purchasing:** if a group buys each other's work to boost correlation scores, does the system detect this? Transaction graph analysis is expensive but could flag suspicious patterns.
