# Database Architecture

This document explains the database systems used in the CryptoArt Studio App.

## Current Focus: Basics Only

The app is currently focused on **basics only**:
- **Creator Core**: NFT collections and mints
- **Auctionhouse**: Listings and bids (tracked by backend indexer)

Subscription caching and other advanced features are commented out and will be implemented later.

---

## Database System

### PostgreSQL (`@repo/db`) - Primary Database
**Package**: `packages/db`  
**ORM**: Drizzle ORM  
**Purpose**: Persistent data storage

**What it stores:**
- NFT collections and minting history (Creator Core - Studio App)
- Auction listings and bids (Auctionhouse - Backend Indexer)

**Active Tables:**
- `nft_collections` - Deployed NFT contracts
- `collection_mints` - NFT minting history
- `auction_listings` - Marketplace listings (from backend indexer)
- `auction_bids` - Auction bid history (from backend indexer)

**Commented Out (Future):**
- Subscription/subscriber cache tables
- Clanker tokens
- Airdrop tables

---

## Backend Indexer Integration

The backend (`apps/backend`) actively uses the database to track auctionhouse events:

### Events Tracked
- `CreateListing` → Stored in `auction_listings`
- `BidEvent` → Stored in `auction_bids`
- `ModifyListing` → Updates `auction_listings`
- `CancelListing` → Updates `auction_listings`
- `FinalizeListing` → Updates `auction_listings`

### Storage Functions (`apps/backend/storage.js`)
- `upsertListing()` - Store/update listings
- `insertBid()` - Record bids
- `updateListingStatus()` - Update listing state

---

## Environment Variables

See `ENVIRONMENT_SETUP.md` for complete environment variable documentation.

### Required for Database

```bash
# PostgreSQL Database Connection
POSTGRES_URL="postgres://username:password@host:port/database"
POSTGRES_PRISMA_URL="postgres://username:password@host:port/database"
POSTGRES_URL_NON_POOLING="postgres://username:password@host:port/database"
```

---

## Database Setup Instructions

### PostgreSQL Setup

1. **Create a PostgreSQL Database**
   - **Vercel**: Go to your project → Storage → Create Database → Postgres
   - **Supabase**: Create new project → Copy connection string
   - **Railway**: Create new service → PostgreSQL → Copy connection string
   - **Neon**: Create new project → Copy connection string

2. **Run Database Migrations**
   ```bash
   cd packages/db
   pnpm install
   pnpm run db:push
   ```
   This creates all necessary tables:
   - `nft_collections` - Deployed NFT contracts (Creator Core - Studio App)
   - `collection_mints` - NFT minting history (Creator Core - Studio App)
   - `auction_listings` - Marketplace auction listings (Auctionhouse - Backend Indexer)
   - `auction_bids` - Auction bid history (Auctionhouse - Backend Indexer)
   
   **Note**: Subscription cache, subscriber cache, clanker tokens, and airdrop tables are commented out and will be added when implementing those features.

3. **Verify Tables Created**
   ```bash
   pnpm run db:studio
   # Opens Drizzle Studio at http://localhost:4983
   ```

---

## What Each Database Stores

### PostgreSQL Tables

**Active Tables (Focus on Basics):**

| Table | Purpose | Used By |
|-------|---------|---------|
| `nft_collections` | Track deployed NFT contracts (Creator Core) | Studio App |
| `collection_mints` | Track NFT mints (Creator Core) | Studio App |
| `auction_listings` | Track marketplace listings (Auctionhouse) | Backend Indexer |
| `auction_bids` | Track auction bids (Auctionhouse) | Backend Indexer |

**Commented Out (Future Use):**
- `subscriptions_cache` - Will be used when implementing subscription features
- `subscribers_cache` - Will be used when implementing subscription features
- `clanker_tokens` - Not implemented yet
- Airdrop tables - Will be used in subscriptions section

---

## Related Documentation

- **Database Usage**: `DATABASE_USAGE.md`
- **Environment Setup**: `ENVIRONMENT_SETUP.md`
- **Schema Definition**: `packages/db/src/schema.ts`
- **Backend Indexer**: `apps/backend/README.md`
