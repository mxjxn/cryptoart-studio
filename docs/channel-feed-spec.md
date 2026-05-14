# Channel-Based Feed Specification

> **Status**: Draft — Design document for review before implementation
> **Depends on**: [timeline-feed-spec.md](./timeline-feed-spec.md), [feed-curation-spec.md](./feed-curation-spec.md)
> **Date**: 2026-05-11
> **Supersedes**: timeline-feed-spec.md — the feed architecture is channel-first, not event-first

## Overview

The feed is built on **Farcaster channels**, not on on-chain events. Channels are where the art conversation already lives. The cryptoart.social feed reads from those channels and enriches the content with marketplace data — making the existing art community shoppable without changing where people talk.

**The demand signal:** "The /cryptoart channel, but better." Same community, same conversation, but now when someone posts about a piece, you can buy it.

---

## Core Architecture Shift

### Before (timeline-feed-spec.md)
```
Subgraph events (primary) → merge → Farcaster casts (secondary) → feed
```

### After (this spec)
```
Farcaster channels (primary) → enrich with on-chain data → feed
```

The feed is a **Farcaster channel reader** with a marketplace enrichment layer. On-chain events (bids, sales, listings) appear in the feed as timeline items, but they enter the feed *through* the channel context — not as an independent data source.

---

## Farcaster Channels as Feed Rooms

### Default Channels

| Channel | Farcaster ID | Role | Content Mix |
|---------|-------------|------|-------------|
| `/cryptoart` | Primary | The main art community | Art posts, artist spotlights, market discussion, critiques |
| `/generative` | Featured | Algorithmic / generative art | Process videos, output sharing, tool discussion |
| `/photography` | Featured | Digital photography | Prints, editions, artist conversations |
| `/1of1` | Featured | One-of-one art | High-value single pieces, auction culture |

Channels are configurable in Postgres — admins can add, remove, or reorder featured channels without a deploy.

### Channel Following

Users follow channels (not just individual artists). The feed shows:

1. **All posts from followed channels** — the primary content river
2. **On-chain events from artists active in those channels** — enrichment layer
3. **Individual artist follows** — cross-channel, regardless of which channel the artist posts in

A user might follow `/cryptoart` (broad) and also follow a specific generative artist who posts in both `/cryptoart` and `/generative`. They see everything from `/cryptoart` plus that artist's posts from any channel.

### Channel Data Model

**New Postgres table: `channel_configs`**

| Column | Type | Description |
|--------|------|-------------|
| `channel_id` | text PK | Farcaster channel ID (e.g., "cryptoart") |
| `display_name` | text | Human-readable name |
| `description` | text | Channel description |
| `is_featured` | boolean | Show in channel discovery |
| `display_order` | integer | Order in channel picker |
| `icon_url` | text | Channel icon |
| `is_active` | boolean | Whether channel is enabled in the feed |
| `content_mix` | jsonb | Channel-specific feed behavior config |
| `created_at` | timestamp | |

**`content_mix` config per channel:**

```
{
  "show_onchain_events": true,       // Show bids/sales from artists in this channel
  "show_listings": true,             // Show new listing events
  "show_casts": true,                // Show regular casts from channel
  "auction_priority": "high",        // "high" | "normal" | "low"
  "default_sort": "chronological"    // "chronological" | "auction_first"
}
```

This lets each channel have its own feed personality. `/cryptoart` might show everything. `/1of1` might prioritize auction events. A future `/subscriptions` channel might only show subscription-related content.

---

## Data Flow

```
┌──────────────────────────────────────────────────────┐
│                    USER OPENS APP                      │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  What channels   │
              │  does user follow?│
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌────────────┐ ┌──────────┐ ┌──────────┐
   │ /cryptoart │ │/generative│ │ follows  │
   │  channel   │ │  channel  │ │ artists  │
   └─────┬──────┘ └────┬─────┘ └────┬─────┘
         │              │            │
         ▼              ▼            ▼
   ┌─────────────────────────────────────┐
   │     FETCH FROM NEYNAR API            │
   │  (casts from channels + followed     │
   │   artists, recent N items)            │
   └──────────────┬──────────────────────┘
                  │
                  ▼
   ┌─────────────────────────────────────┐
   │     ENRICHMENT LAYER                 │
   │                                     │
   │  For each cast:                      │
   │  1. Extract mentioned addresses      │
   │  2. Check subgraph: active listing?  │
   │  3. Check subgraph: artist profile?  │
   │  4. Check trust tier of author       │
   │  5. Apply curation rules              │
   │  6. Append enrichment data            │
   └──────────────┬──────────────────────┘
                  │
                  ▼
   ┌─────────────────────────────────────┐
   │     INJECT ON-CHAIN EVENTS           │
   │                                     │
   │  Between casts, insert:              │
   │  - Bids on active listings           │
   │  - New listings from followed arts   │
   │  - Auction countdowns                │
   │  (from subgraph, filtered by         │
   │   channel context)                   │
   └──────────────┬──────────────────────┘
                  │
                  ▼
   ┌─────────────────────────────────────┐
   │     MERGED, ENRICHED FEED            │
   │                                     │
   │  Casts with marketplace context     │
   │  + on-chain events interspersed     │
   │  + curation filters applied          │
   │  + sorted chronologically            │
   └─────────────────────────────────────┘
```

---

## Cast Enrichment

When a cast is pulled from a channel, the enrichment layer checks whether it connects to the marketplace. This is what makes the channel "shoppable."

### Enrichment Rules

A cast gets enriched when:

1. **The cast mentions an ETH address** that has an active listing on cryptoart.social
   → Attach listing card: artwork image, current bid, time remaining, "Bid now" CTA

2. **The cast embeds a cryptoart.social URL** (listing page, share page)
   → Replace embed with rich listing card

3. **The cast's author has an active listing** (even if the cast doesn't mention it)
   → Attach subtle "Artist has active auction" badge with link

4. **The cast mentions an artist** whose work is available for purchase
   → Attach "Browse [Artist]'s work" link

5. **The cast's author is a followed artist** who just listed something
   → Insert a `NEW_LISTING` event card immediately after the cast (or before, depending on recency)

### Enrichment Output

Each cast in the feed response includes an optional `enrichment` object:

```
CastEvent {
  // Standard Farcaster cast data (from Neynar)
  castHash: string
  author: { fid, username, displayName, pfpUrl, ethAddress }
  text: string
  embeds: Embed[]
  timestamp: number
  reactions: { likes, recasts, replies }
  channel: { id, name }

  // Marketplace enrichment (computed)
  enrichment?: {
    type: 'active_listing' | 'artist_has_work' | 'browse_artist' | 'gallery_ref'
    listing?: {
      listingId: string
      chainId: number
      tokenImage: string
      currentBid: string
      timeRemaining: number
      listingType: string
      actionUrl: string        // Deep link to listing in app
    }
    artist?: {
      address: string
      displayName: string
      activeListingsCount: number
      profileUrl: string
    }
    gallery?: {
      id: string
      title: string
      curatorName: string
      galleryUrl: string
    }
  }
}
```

---

## On-Chain Event Injection

On-chain events (bids, sales, listings) are not an independent feed source. They are **injected into the cast-based feed** based on channel context.

### Injection Rules

| Event Type | Injection Condition | Position |
|------------|-------------------|----------|
| `BID_PLACED` | The listing's seller has posted in a followed channel within the last 7 days | Inserted chronologically among casts |
| `NEW_LISTING` | The seller is a followed artist (individual follow, not just channel member) | Inserted at timestamp, with artist follow badge |
| `PURCHASE` | The listing's seller has posted in a followed channel within the last 7 days | Inserted chronologically |
| `AUCTION_ENDING_SOON` | Active listing from an artist in a followed channel, ending within 1 hour | Inserted near top of feed with urgency styling |
| `AUCTION_WON` | Winning bidder is the current user, or seller is a followed artist | Inserted chronologically |

### Why "posted in a followed channel within 7 days"?

This prevents the feed from becoming a firehose of every listing on the platform. Only artists who are *active participants in the community* get their marketplace events injected into the feed. An artist who listed once and disappeared doesn't inject events into /cryptoart.

The 7-day window means recent active community members surface their marketplace activity. It decays naturally — if an artist stops posting in channels, their listing events stop appearing.

### Multi-Chain Events

Events from both Base and Ethereum mainnet are injected. The `chainId` field on every event ensures correct deep links and display. No special handling needed — the enrichment layer queries both subgraph endpoints (via `getConfiguredSubgraphEndpoints()`) and merges results.

---

## Feed API Design

### Primary Endpoint

```
GET /api/feed
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `cursor` | string | null | Pagination cursor |
| `limit` | number | 25 | Items per page (max 50) |
| `channel` | string | null | Filter to specific channel ID (e.g., "cryptoart") |
| `types` | string | null | Comma-separated: `cast,bid,listing,purchase,auction_ending` |
| `for` | string | null | ETH address for personalization |

**Personalization** (when `for` is provided):

1. Fetch user's followed channels and followed artists from Postgres
2. Query Neynar for casts from those channels + artists
3. Enrich casts with marketplace data
4. Inject on-chain events from artists active in those channels
5. Include `OUTBID` events for listings the user has bid on
6. Include `AUCTION_ENDING_SOON` for favorited listings
7. Return `unreadCount` based on last-seen timestamp

**Response:**

```
{
  events: FeedEvent[],         // Union of CastEvent + OnChainEvent
  channels: ChannelSummary[],  // User's followed channels with unread counts
  nextCursor: string | null,
  unreadCount: number
}
```

### Feed Event Types

```
type FeedEvent = CastEvent | OnChainEvent

CastEvent {
  kind: 'cast'
  castHash: string
  author: { fid, username, displayName, pfpUrl }
  text: string
  embeds: Embed[]
  timestamp: number
  channel: { id, name }
  reactions: { likes, recasts, replies }
  enrichment?: ListingEnrichment | ArtistEnrichment | GalleryEnrichment
}

OnChainEvent {
  kind: 'bid' | 'listing' | 'purchase' | 'auction_ending' | 'outbid' | 'auction_won'
  id: string
  type: string
  timestamp: number
  actor: { ethAddress, fid?, username?, displayName?, pfpUrl? }
  subject: { listingId, chainId, tokenAddress, tokenId, tokenImage, collectionName }
  amount?: string
  timeRemaining?: number
  endTime?: number
  context: { channel: { id, name } }   // Which channel context triggered this event
}
```

### Channel Discovery Endpoint

```
GET /api/channels
```

Returns all available channels with metadata, user's follow state, and activity level.

### Follow/Unfollow Channel

```
POST /api/channels/follow
DELETE /api/channels/follow
```

Body: `{ channelId: string }`

Stored in Postgres (new table: `channel_follows`).

### Follow/Unfollow Artist

```
POST /api/artists/follow
DELETE /api/artists/follow
```

Body: `{ artistAddress: string }`

Stored in existing `follows` table.

---

## Channel Navigation UI

### Channel Picker

A horizontal row of channel pills at the top of the feed:
```
[ All ] [ /cryptoart ] [ /generative ] [ /photography ] [ /1of1 ] [ + ]
```

- **All**: Default. Shows merged feed from all followed channels.
- **Specific channel**: Filter to that channel only.
- **+**: Channel discovery — browse and follow new channels.

### Artist Follow from Channel

When reading a cast in a channel, the user can follow the author as an *artist* (not just see their posts). This is different from following on Farcaster — it means "show me this artist's marketplace events too."

**Follow artist** = subscribe to their on-chain events in the feed
**Follow on Farcaster** = see their casts everywhere

Both are useful. Both should be available from the cast author's profile card.

### Channel Context on Events

When an on-chain event appears in the feed, it shows which channel context surfaced it:
- "Bid on [Artwork] by [Artist] · via /cryptoart"

This gives users a sense of why they're seeing this event and lets them discover which channels surface the best content.

---

## Curation Integration (from feed-curation-spec.md)

The curation system layers on top of the channel feed:

### Channel-Level Curation

| Action | Effect |
|--------|--------|
| **Channel curator boosts a cast** | Cast appears higher in the channel feed for all followers |
| **Channel curator suppresses a cast** | Hidden from the channel feed (still on Farcaster) |
| **Channel curator pins a cast** | Pinned to top of channel feed for a time period |

### Trust Tiers in Channel Context

Trust tiers (from feed-curation-spec.md) apply to channel casts:

| Tier | Channel Cast Behavior |
|------|----------------------|
| 0 (UNVERIFIED) | Casts visible in channels, but no marketplace enrichment (their work isn't on the platform) |
| 1 (LISTED) | Casts visible, basic enrichment (artist name, link to listings) |
| 2+ (SOLD) | Full enrichment (active listing cards, bid CTAs, artist profile badges) |
| 5 (CURATOR) | Can boost/suppress/pin content in channels they moderate |

### Spam in Channels

Listing spam suppression (from feed-curation-spec.md) applies to on-chain event injection. An artist who lists 50 editions at once doesn't inject 50 events into the channel feed — they get grouped and collapsed.

But **cast-level spam** is different. If someone is posting low-effort content in a channel, that's a channel moderation issue, not a marketplace issue. Channel curators handle this.

---

## Real-Time Updates

Same SSE approach as timeline-feed-spec.md, but channel-scoped:

```
GET /api/feed/live?channels=cryptoart,generative
```

SSE event types:
- `cast` — new cast in followed channel
- `bid` — new bid on listing from followed channel artist
- `purchase` — sale from followed channel artist
- `outbid` — current user outbid
- `auction_ending` — countdown update for active auction from followed artist
- `enrichment_update` — a previously-seen cast got enriched (e.g., artist just listed something)

---

## PWA Integration

Channel notifications:

| Event | Push Behavior |
|-------|--------------|
| New cast in followed channel | No push (too noisy) |
| Bid on listing from followed artist | Push with artwork thumbnail + bid amount |
| `AUCTION_ENDING_SOON` for favorited listing | Push with countdown |
| `OUTBID` | Push with "You've been outbid" + "Bid again" CTA |
| `AUCTION_WON` for followed artist | Push with celebration + artwork |
| Curator pin in followed channel | Push with pinned content preview |

Badge count: `unreadCount` from feed API, reflecting unseen items since last app open.

---

## Implementation Order

### Phase 1: Channel Feed (casts only)
1. Create `channel_configs` and `channel_follows` tables in Postgres
2. Seed with default channels (/cryptoart, /generative, /photography, /1of1)
3. Build `GET /api/feed` that fetches casts from Neynar for followed channels
4. Render basic cast feed with channel pills navigation
5. Build channel follow/unfollow endpoints
6. **No enrichment yet** — just reading Farcaster channels into the app

### Phase 2: Artist Follows + Enrichment
1. Build artist follow endpoints (distinct from channel follows)
2. For each cast in the feed, check if the author has active listings on the platform
3. Attach `enrichment` data to casts (listing cards, artist badges)
4. Deep links from enriched casts to listing pages in the app

### Phase 3: On-Chain Event Injection
1. For followed artists active in followed channels, inject their marketplace events
2. Apply 7-day channel activity window (only inject events from artists who've posted recently)
3. Inject `AUCTION_ENDING_SOON` for favorited listings
4. Inject `OUTBID` for current user's active bids
5. Group listing spam per feed-curation-spec.md rules

### Phase 4: Curation + Trust Tiers
1. Implement trust tier computation and storage
2. Tier-based enrichment (full cards for Tier 2+, basic for Tier 1, none for Tier 0)
3. Channel curator actions (boost, suppress, pin)
4. Curator moderation UI

### Phase 5: Real-Time + PWA
1. SSE endpoint for live updates
2. Channel-scoped event push
3. Push notification setup for high-urgency events
4. Badge count
5. PWA manifest + service worker + install prompt

---

## Open Questions

1. **Channel curator selection**: Who moderates /cryptoart? You? A group of trusted community members? Should channel moderation be a visible role (people know who the curators are) or invisible?

2. **Cross-channel follows**: If a user follows an artist who posts in /cryptoart and /generative, do they see that artist's posts from both channels in "All", or only when viewing each channel individually? I'd assume "All" merges everything, but worth confirming.

3. **Channel discovery beyond featured**: Should users be able to create their own channels within the app, or are channels strictly Farcaster channels that the app indexes? If the latter, you're limited to what exists on Farcaster. If the former, you can create niche art communities (e.g., /glitch-art, /ai-art, /photography-fine-art).

4. **Enrichment for non-platform artists**: When someone in /cryptoart posts about an artist who ISN'T on cryptoart.social (no listings), do we show nothing? Or do we show a "This artist isn't on cryptoart.social yet" with a nudge to the artist? That could be a growth mechanism.

5. **Channel activity windows**: The 7-day window for event injection — should this be per-channel or global? An artist might be active in /generative but not /cryptoart. Should their events only inject when viewing /generative?
