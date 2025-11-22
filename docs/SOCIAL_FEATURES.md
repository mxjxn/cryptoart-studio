# Social Features - Cross-Platform Integration

This document describes the social layer that connects **such.market**, **such.gallery**, and **cryptoart.social**.

## Architecture Overview

```
Blockchain Events
    ↓
The Graph Subgraphs
    ├─ Auctionhouse Subgraph (auctions)
    └─ LSSVM Subgraph (pools)
    ↓
Social API Layer (this repo)
    ├─ Cache auction completions
    ├─ Track pool swaps
    ├─ Calculate reputation scores
    └─ Manage patronships
    ↓
All Three Platforms Consume APIs
```

## Database Schema

### Core Tables

#### `user_profiles`
Unified user profiles across all platforms. Links FIDs to usernames, avatars, and verified addresses.

#### `reputation_scores`
Cross-platform reputation tracking:
- **Creator metrics**: collections deployed, revenue, unique collectors
- **Trader metrics**: trade volume, pools created, LP fees
- **Collector metrics**: total spent, auctions won, items collected
- **Curator metrics**: galleries curated, referral revenue

#### `patronships`
Tracks collector-creator relationships:
- First/last purchase dates
- Total spent on creator's work
- Items owned
- Platform breakdown (market vs gallery purchases)
- Patron tier (supporter → collector → patron → whale)

#### `auctionCompletionsCache`
Recently finished auctions with rich metadata:
- NFT details and metadata
- Winner, seller, curator info
- Final bid, bid count
- Social flags (first win, record price, featured)
- 30-day cache TTL

#### `marketSwapsCache`
LSSVM pool trades from such.market:
- Pool info, trader, NFT details
- Trade direction (buy/sell), amounts
- Fees paid
- 30-day cache TTL

## API Endpoints

### GET `/api/social/recent-auctions`

Returns recently completed auctions with full context.

**Query Parameters:**
- `limit`: Number of auctions (default: 50, max: 100)
- `offset`: Pagination offset
- `featured`: Filter featured auctions only

**Response:**
```json
{
  "auctions": [
    {
      "listingId": "123",
      "nft": {
        "contract": "0x...",
        "tokenId": "1",
        "metadata": { "name": "Art #1", "image": "..." }
      },
      "auction": {
        "finalBid": "1000000000000000000",
        "bidCount": 5,
        "completedAt": "2025-01-15T12:00:00Z",
        "duration": 86400000
      },
      "winner": {
        "fid": 123,
        "username": "collector",
        "displayName": "Top Collector",
        "avatar": "...",
        "address": "0x..."
      },
      "seller": { ... },
      "curator": { ... },
      "flags": {
        "featured": false,
        "isFirstWin": true,
        "isRecordPrice": false
      }
    }
  ],
  "pagination": { ... }
}
```

### GET `/api/social/top-patrons`

Returns leaderboard of top collectors by total spend.

**Query Parameters:**
- `limit`: Number of patrons (default: 100, max: 500)
- `offset`: Pagination offset
- `period`: Time filter - 'all', '30d', '7d'
- `minTier`: Minimum tier - 'supporter', 'collector', 'patron', 'whale'

**Response:**
```json
{
  "patrons": [
    {
      "rank": 1,
      "fid": 456,
      "username": "whale_collector",
      "displayName": "The Whale",
      "avatar": "...",
      "stats": {
        "totalSpent": "50000000000000000000",
        "creatorsSupported": 12,
        "itemsCollected": 45,
        "marketPurchases": 20,
        "galleryPurchases": 25
      },
      "patronTier": "whale",
      "reputation": { ... }
    }
  ],
  "pagination": { ... }
}
```

### GET `/api/social/creator/[fid]/patrons`

Returns top patrons for a specific creator.

**Query Parameters:**
- `limit`: Number of patrons (default: 50, max: 200)

**Response:**
```json
{
  "creator": {
    "fid": 789,
    "username": "artist",
    "displayName": "Top Artist"
  },
  "patrons": [
    {
      "rank": 1,
      "fid": 456,
      "username": "collector1",
      "relationship": {
        "totalSpent": "5000000000000000000",
        "itemsOwned": 8,
        "marketPurchases": 3,
        "galleryPurchases": 5,
        "daysSinceFirstPurchase": 90
      },
      "patronTier": "patron",
      "isTopPatron": true
    }
  ],
  "summary": {
    "totalPatrons": 25,
    "totalRevenue": "25000000000000000000",
    "marketPurchases": 40,
    "galleryPurchases": 60
  }
}
```

### GET `/api/social/sync/auction-completions`

Syncs completed auctions from subgraph to cache. Should be called periodically via cron.

**Authorization:** Requires `CRON_SECRET` or `ADMIN_SECRET` bearer token.

**Query Parameters:**
- `limit`: Number of auctions to sync (default: 50, max: 500)
- `forceRefresh`: Re-sync existing auctions

**Response:**
```json
{
  "success": true,
  "synced": 15,
  "skipped": 5,
  "total": 20,
  "timestamp": "2025-01-15T12:00:00Z"
}
```

### POST `/api/social/track-swap`

Tracks LSSVM pool swaps from such.market. Called by such.market after each swap.

**Authorization:** Requires `SOCIAL_API_KEY` bearer token.

**Request Body:**
```json
{
  "txHash": "0x...",
  "poolAddress": "0x...",
  "poolType": "LINEAR",
  "nftContract": "0x...",
  "tokenIds": ["1", "2"],
  "trader": {
    "address": "0x...",
    "fid": 123
  },
  "isBuy": true,
  "ethAmount": "1000000000000000000",
  "spotPrice": "1000000000000000000",
  "timestamp": 1705320000,
  "blockNumber": 12345678
}
```

**Response:**
```json
{
  "success": true,
  "cached": true,
  "traderFid": 123
}
```

## Environment Variables

Add these to `.env`:

```bash
# Auctionhouse subgraph URL
AUCTIONHOUSE_SUBGRAPH_URL=https://api.studio.thegraph.com/query/YOUR_ID/cryptoart-auctionhouse/version/latest

# API authentication
SOCIAL_API_KEY=your_random_secret_key_here
CRON_SECRET=your_cron_secret_here
ADMIN_SECRET=your_admin_secret_here
```

## Integration Guide

### For such.market (LSSVM Platform)

After a successful swap, call the tracking endpoint:

```typescript
// In such-lssvm repo
async function onSwapComplete(swap: SwapEvent) {
  await fetch('https://api.cryptoart.social/api/social/track-swap', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SOCIAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      txHash: swap.txHash,
      poolAddress: swap.poolAddress,
      poolType: swap.poolType,
      nftContract: swap.nftContract,
      tokenIds: swap.tokenIds,
      trader: {
        address: swap.trader,
        fid: userFid, // If known
      },
      isBuy: swap.isBuy,
      ethAmount: swap.ethAmount.toString(),
      spotPrice: swap.spotPrice.toString(),
      timestamp: swap.timestamp,
      blockNumber: swap.blockNumber,
    }),
  });
}
```

### For such.gallery (Auction Platform)

Query recent auctions and top patrons:

```typescript
// Fetch recent auctions feed
const { auctions } = await fetch(
  'https://api.cryptoart.social/api/social/recent-auctions?limit=50'
).then(r => r.json());

// Fetch top patrons leaderboard
const { patrons } = await fetch(
  'https://api.cryptoart.social/api/social/top-patrons?period=30d&limit=100'
).then(r => r.json());
```

### For cryptoart.social (Creator Platform)

Show creator's top patrons:

```typescript
// Fetch creator's top collectors
const { patrons, summary } = await fetch(
  `https://api.cryptoart.social/api/social/creator/${creatorFid}/patrons`
).then(r => r.json());
```

## Cron Jobs

Set up periodic syncing for auction completions:

**Vercel Cron Configuration** (vercel.json):
```json
{
  "crons": [
    {
      "path": "/api/social/sync/auction-completions",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## Database Migration

To apply the schema:

```bash
# Generate migration
pnpm db:generate

# Apply to database
pnpm db:push

# Or run migration
pnpm db:migrate
```

## Patron Tier Calculation

Tiers are automatically calculated based on total spent:

- **Supporter**: < 0.1 ETH
- **Collector**: 0.1 - 1 ETH
- **Patron**: 1 - 5 ETH
- **Whale**: ≥ 5 ETH

## Social Flags

### `isFirstWin`
True if this is the collector's first auction win. Creates achievement opportunity.

### `isRecordPrice`
True if this is the highest sale price for this creator's work. Highlights milestone.

### `featured`
Manually set flag to feature specific auctions in feeds.

## Next Steps

**Sprint 2: such.gallery UI**
- Build recently finished auctions feed page
- Build top patrons leaderboard page
- Build collector profile pages

**Sprint 3: cryptoart.social Enhancements**
- Creator's top patrons dashboard
- Sales breakdown analytics
- Patron export for airdrops

**Sprint 4: Advanced Features**
- Achievement/badge system
- Curator performance tracking
- Referral revenue dashboards
