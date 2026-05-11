# Timeline Feed Specification

> **Status**: Draft — Design document for review before implementation
> **Date**: 2026-05-11

## Overview

A unified chronological timeline that merges on-chain marketplace activity (bids, listings, purchases) with Farcaster social content (casts about art/artists) into a single feed. Auction events become first-class citizens on the timeline — a bid at 2.4 ETH with 18 minutes left sits next to someone saying "this piece changed how I think about generative art."

## Core Principles

1. **Events are content.** A bid is not metadata — it is a timeline item with the same visual weight as a social post.
2. **The feed is art-first.** Chronological ordering, filtered by the user's interests (followed artists, favorited listings, watched collections), not by social graph popularity.
3. **Rich rendering is a client bonus, not a requirement.** Timeline items are backed by real Farcaster casts (Option C) — readable in any client, rendered richly in ours.
4. **Subgraph is the source of truth for on-chain events.** Postgres is the social layer (follows, favorites, preferences, notification state).

---

## Data Sources

### Source 1: Subgraph (on-chain events)

Already indexed in `packages/auctionhouse-subgraph`:

| Entity | Fields We Need | Timeline Use |
|--------|---------------|--------------|
| `Bid` | `timestamp`, `bidder`, `amount`, `listingId` | Bid event card |
| `Purchase` | `timestamp`, `buyer`, `amount`, `listingId` | Sale event card |
| `Listing` | `startTime`, `endTime`, `status`, `hasBid`, `seller`, `tokenAddress`, `tokenId`, `listingType`, `initialAmount` | New listing event, auction countdown |
| `Offer` | `timestamp`, `offerer`, `amount`, `status`, `listingId` | Offer event card |

### Source 2: Farcaster (social content)

Pulled via Neynar API (already integrated for user caching):

- Casts mentioning artist addresses or collection contracts
- Casts from followed users that mention art-related topics
- Casts with embeds linking to cryptoart.social listing pages

### Source 3: Postgres (user state + curation)

Already exists in `packages/db/src/schema.ts`:

| Table | Role |
|-------|------|
| `follows` | Filter: only show activity for followed artists/collectors |
| `favorites` | Filter: show events on favorited listings |
| `curation` / `curationItems` | Gallery events — "X added this piece to their gallery" |
| `userCache` | Resolve ETH addresses to Farcaster profiles (avatar, username) |
| `notifications` | Already tracks `notificationWorkerState` (last processed block) — reuse for feed cursor |

---

## Timeline Event Types

Each item on the timeline is a `TimelineEvent` with a `type` field that determines rendering.

### On-Chain Events

| Type | Trigger | Key Data | Rich Render |
|------|---------|----------|-------------|
| `NEW_LISTING` | Listing created | Artist, token, price/min bid, start time, listing type | Artwork image, artist profile, listing type badge, countdown to start |
| `BID_PLACED` | Bid event | Bidder, amount, listing, time remaining | Bidder avatar, ETH amount (large), artwork thumbnail, "X minutes left" badge |
| `PURCHASE` | Sale completed | Buyer, final price, listing | "SOLD" badge, buyer avatar, final price, artwork image |
| `AUCTION_ENDING_SOON` | Scheduled (5min, 1hr marks) | Listing, current top bid, time remaining | Countdown timer, current bid, "ending soon" urgency styling |
| `AUCTION_WON` | Auction finalized | Winner, final price, listing | Celebration treatment — "X won Y by Z for ΞW" |
| `NEW_OFFER` | Offer placed | Offerer, amount, listing | Offer amount, artwork thumbnail |
| `OFFER_ACCEPTED` | Offer accepted | Buyer, amount, listing | "Accepted" badge |
| `OUTBID` | User outbid (personalized) | New top bidder, new amount, listing, user's old bid | Urgency — "You've been outbid" with "Bid again" CTA |

### Social Events

| Type | Trigger | Key Data | Rich Render |
|------|---------|----------|-------------|
| `CAST` | Relevant Farcaster cast | Author, text, embeds, reactions | Standard cast render with art context enrichment |
| `GALLERY_CREATED` | User creates a curation | Curator, gallery title, item count | Gallery preview card |
| `GALLERY_ITEM_ADDED` | Item added to gallery | Curator, gallery, listing added | "X added this piece to [Gallery Name]" |
| `ARTIST_FOLLOWED` | User follows an artist (social signal) | Follower, followed artist | Lightweight — "X started following Y" |

### Derived/Scheduled Events

| Type | Trigger | Key Data |
|------|---------|----------|
| `AUCTION_ENDING_SOON` | Cron job checks active listings with endTime approaching | Listing, top bid, time remaining |
| `PRICE_MILESTONE` | Spot price crosses threshold in LSSVM pool | Pool, token, old price, new price |
| `DAILY_DIGEST` | Cron job summarizes 24h activity | Aggregated stats, top events |

---

## Unified Timeline Event Schema

A single `TimelineEvent` type that all sources map into:

```
TimelineEvent {
  id: string              // Unique: subgraph tx hash + log index, or "fc-{castHash}", or "scheduled-{type}-{listingId}-{timestamp}"
  type: TimelineEventType // Union of all types above
  timestamp: number       // Unix seconds — the universal sort key
  
  // Actor — who triggered this event
  actor: {
    ethAddress: string
    fid?: number
    username?: string
    displayName?: string
    pfpUrl?: string
  }
  
  // Subject — what this event is about (the artwork/listing)
  subject: {
    listingId?: string
    tokenAddress?: string
    tokenId?: string
    tokenName?: string
    tokenImage?: string
    collectionName?: string
    collectionAddress?: string
  }
  
  // Financial context
  amount?: string         // ETH amount as string (precision-safe)
  currency?: string       // "ETH" | token symbol
  
  // Time context (for auctions)
  timeRemaining?: number  // Seconds until endTime (null if not time-sensitive)
  endTime?: number        // Absolute endTime for countdowns
  
  // Social context
  castHash?: string       // If this event maps to a Farcaster cast
  text?: string           // Cast text or event description
  
  // Metadata — type-specific additional data
  metadata?: Record<string, any>  // e.g., gallery name, curator note, old bid amount for OUTBID
}
```

---

## Timeline API Design

### Primary Endpoint

```
GET /api/feed
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `cursor` | string | null | Pagination cursor (base64-encoded timestamp + event ID) |
| `limit` | number | 25 | Items per page (max 50) |
| `types` | string | null | Comma-separated event types to include (e.g., `BID_PLACED,PURCHASE,CAST`) |
| `excludeTypes` | string | null | Comma-separated types to exclude |
| `artist` | string | null | Filter to events involving this ETH address (as seller or token creator) |
| `collection` | string | null | Filter to events for this contract address |
| `listingId` | string | null | Filter to events for a specific listing |

**Personalization** (requires auth / wallet signature):

| Param | Type | Description |
|-------|------|-------------|
| `for` | string (ETH address) | Personalize feed based on this user's follows, favorites, and bid history |

When `for` is provided, the feed algorithm:
1. **Boosts** events on favorited listings
2. **Boosts** events by followed artists
3. **Includes** `OUTBID` events (personal — only relevant to this user)
4. **Includes** events on listings the user has bid on
5. **Deprioritizes** events the user has already seen (track via `notificationWorkerState` pattern — last seen timestamp per user)

**Response:**

```
{
  events: TimelineEvent[],
  nextCursor: string | null,   // Pass as cursor param for next page
  prevCursor: string | null,   // Pass as cursor param for previous page
  unreadCount: number           // Total unread events since user's last visit (when `for` is provided)
}
```

### Real-Time Updates

For live auction countdowns and instant bid events, use Server-Sent Events (SSE):

```
GET /api/feed/live
```

SSE event types:
- `bid` — new bid placed
- `purchase` — listing sold
- `listing` — new listing created
- `outbid` — user outbid (personalized)
- `countdown` — periodic update with current timeRemaining for active auctions in user's feed

This is simpler than WebSockets for a read-heavy feed and works with Next.js API routes. The client opens one SSE connection and receives push updates, then merges them into the local feed state.

---

## Feed Merge Strategy

The timeline merges three async data sources into one chronological stream:

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Subgraph       │   │    Neynar API   │   │    Postgres      │
│                  │   │                  │   │                  │
│  Bids, Listings, │   │  Relevant Casts  │   │  Gallery events, │
│  Purchases, etc  │   │  from followed   │   │  social signals  │
│                  │   │  artists/users   │   │                  │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                        ┌───────▼───────┐
                        │  Feed Merger  │
                        │  (API Route)  │
                        │               │
                        │  1. Fetch all  │
                        │  2. Normalize  │
                        │  3. Deduplicate│
                        │  4. Sort by ts │
                        │  5. Paginate   │
                        └───────┬───────┘
                                │
                        ┌───────▼───────┐
                        │  Timeline     │
                        │  Response     │
                        └───────────────┘
```

### Deduplication Rules

A bid event and a Farcaster cast about that same bid should NOT appear as two separate items. Rules:

1. **Subgraph events are authoritative for on-chain activity.** If a bid exists in the subgraph, don't create a duplicate from a cast about that bid.
2. **Casts that reference a listingId or transactionHash** should be checked against the subgraph. If the referenced event already exists as a timeline item, enrich the on-chain event with the cast's text/author as `metadata.castContext` instead of creating a separate item.
3. **Casts about art/artists that don't reference a specific on-chain event** remain as standalone `CAST` timeline items.

### Farcaster Cast Publishing (Option C Implementation)

For on-chain events that should appear as casts on Farcaster:

| Event | Cast Behavior |
|-------|--------------|
| `BID_PLACED` | Publish a structured cast via Neynar API from the bidder's behalf (or platform account). Cast text includes: bidder name, artwork, amount, time remaining. Embed: listing page OG image (already exists at `/share/bid-placed/[listingId]`). |
| `AUCTION_WON` | Publish celebration cast. Embed: `/share/auction-won/[listingId]` (already exists). |
| `NEW_LISTING` | Publish listing announcement. Embed: listing OG image. |

**Important:** These casts are opt-in per-listing (the artist/seller controls whether their auction activity is broadcast). Not everything needs to be public — some collectors prefer privacy.

Add a `broadcastActivity` boolean field to the listing configuration or artist settings in Postgres.

---

## PWA Considerations

The timeline feeds directly into PWA capabilities:

| PWA Feature | Timeline Integration |
|-------------|----------------------|
| **Push notifications** | `AUCTION_ENDING_SOON`, `OUTBID`, `AUCTION_WON` events trigger Web Push via existing `notificationTokens` table |
| **Badge count** | `unreadCount` from feed API → displayed as app icon badge |
| **Background sync** | Service worker caches latest feed state, syncs on reconnect |
| **Install prompt** | Trigger after user has engaged with 2+ timeline events (meaningful interaction signal) |

### Service Worker Strategy

```
Cache-first for:
  - Timeline API responses (stale-while-revalidate, 30s TTL)
  - Artwork images
  - User profile images

Network-first for:
  - SSE /feed/live connection
  - Bid/purchase mutations
```

---

## Implementation Order

### Phase 1: Event Stream (subgraph → timeline)
1. Create `/api/feed` endpoint that queries the subgraph for `Bid`, `Purchase`, and `Listing` entities, sorted by `timestamp` descending, with cursor-based pagination
2. Normalize subgraph entities into `TimelineEvent` format
3. Render a basic timeline UI that displays bid events and listing events as cards
4. **No personalization yet** — just all marketplace activity, chronological

### Phase 2: Personalization
1. Add `for` parameter to `/api/feed`
2. Query `follows` and `favorites` tables to boost/filter events
3. Add `OUTBID` event type (check if current user has a bid on the listing)
4. Track last-seen timestamp per user for unread count

### Phase 3: Social Merge
1. Query Neynar API for casts from followed users mentioning watched artists/collections
2. Implement deduplication logic (check if cast references a known on-chain event)
3. Render `CAST` items alongside on-chain events in the timeline
4. Add `GALLERY_CREATED` and `GALLERY_ITEM_ADDED` events from `curation` tables

### Phase 4: Real-Time
1. Add SSE `/api/feed/live` endpoint
2. Client opens SSE connection, receives push updates
3. Implement live countdown timers for `AUCTION_ENDING_SOON`
4. Client-side merge of SSE events into local feed state

### Phase 5: Farcaster Cast Publishing
1. Add `broadcastActivity` preference to listing/artist settings
2. When a bid or sale occurs on a broadcast-enabled listing, publish a structured cast via Neynar
3. Cast embeds point to existing `/share/` OG pages
4. Deduplication ensures the published cast doesn't create a duplicate timeline item

### Phase 6: PWA
1. Add web app manifest and service worker
2. Implement push notifications for high-urgency events
3. Add badge count from `unreadCount`
4. Add install prompt with meaningful trigger

---

## Open Questions

1. **Feed algorithm**: Pure chronological, or weighted (boost recent bids, deprioritize old listings)? Chronological is simpler and more honest. Weighted is more engaging but risks feeling manipulative in an art context.

2. **Cast publishing identity**: Should bids be published from the bidder's Farcaster account (requires their auth/token), from a platform account (@cryptoart or similar), or only shared via the share pages for the bidder to post themselves?

3. **Event retention**: How far back does the timeline go? All time? 30 days? Configurable per user? The subgraph has everything from `startBlock: 38886000` — that's the full history.

4. **Gallery referral integration**: When a purchase happens through a gallery, should the timeline event show "X bought this via [Gallery Name]" with the curator's referral context?

5. **Multi-chain future**: The subgraph currently targets Base (`network: base`). The mainnet deployment of contracts will need a separate subgraph or multi-chain indexer. How does the timeline handle events from multiple chains?
