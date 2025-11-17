# Database Usage Guide

This document explains **where and how** each database table is used in the CryptoArt Studio App.

## Overview

The app uses PostgreSQL (`@repo/db`) for persistent data storage. All database operations use **Drizzle ORM** and are accessed via `getDatabase()` from `@repo/db`.

**Focus**: Currently focusing on basics - Creator Core (NFT collections/mints) and Auctionhouse (listings/bids). Subscription and airdrop features are commented out for future implementation.

---

## Active Database Tables

### 1. NFT Collections (`nft_collections`)

**Purpose**: Track deployed NFT contracts from the Studio (Creator Core)

**Where it's used:**

#### API Routes:
- **`/api/studio/contracts`** (POST) - **TODO: Currently not implemented**
  ```typescript
  // src/app/api/studio/contracts/route.ts
  // TODO: Save to database
  // Should save to nft_collections table
  ```

**Planned Implementation:**
```typescript
// When contract is deployed via ContractDeployer component
await db.insert(nftCollections).values({
  creatorFid: fidNumber,
  contractAddress: address,
  contractType: type, // 'ERC721' | 'ERC1155' | 'ERC6551'
  name,
  symbol,
  chain: 8453, // Base
  deployTxHash: transactionHash,
  status: 'active',
  metadata: {
    baseURI,
    royalties,
    // ... other contract config
  },
});
```

**Current Status**: Schema exists, but API route has TODO comment. Needs implementation.

**Use Cases:**
- List all contracts deployed by a creator
- Track contract deployment status
- Link mints to their parent collection
- Store contract metadata (baseURI, royalties, etc.)

---

### 2. Collection Mints (`collection_mints`)

**Purpose**: Track individual NFT mints from deployed collections (Creator Core)

**Where it's used:**

#### API Routes:
- **`/api/studio/nfts`** (POST) - **TODO: Currently not implemented**
  ```typescript
  // src/app/api/studio/nfts/route.ts
  // TODO: Save to database
  // Should save to collection_mints table
  ```

**Planned Implementation:**
```typescript
// When NFT is minted via NFTMinter, SeriesUploader, or EditionCreator
await db.insert(collectionMints).values({
  collectionId: collectionId, // Reference to nft_collections.id
  tokenId: tokenId,
  recipientAddress: owner,
  recipientFid: recipientFid, // If known
  txHash: transactionHash,
  metadata: {
    tokenURI,
    image,
    name,
    description,
    attributes,
  },
});
```

**Current Status**: Schema exists, but API route has TODO comment. Needs implementation.

**Use Cases:**
- Track all mints from a collection
- Query mints by recipient
- Store NFT metadata
- Link mints to their collection

---

### 3. Auction Listings (`auction_listings`)

**Purpose**: Track marketplace auction listings (Auctionhouse - Backend Indexer)

**Where it's used:**

#### Backend Indexer (`apps/backend/storage.js`):
- **`upsertListing(listingData)`**: Store or update listing from CreateListing event
- **`updateListingStatus(listingId, updates)`**: Update listing on ModifyListing, CancelListing, FinalizeListing events

#### Backend Indexer (`apps/backend/index.js`):
- Monitors Base network for marketplace events:
  - `CreateListing` - New auction listings
  - `ModifyListing` - Listing updates
  - `CancelListing` - Cancelled listings
  - `FinalizeListing` - Completed auctions

**Data Flow:**
1. Backend indexer detects `CreateListing` event on-chain
2. Calls `upsertListing()` to store in database
3. Updates listing on subsequent events (bids, modifications, finalization)

**Current Status**: Schema exists and is actively used by backend indexer.

---

### 4. Auction Bids (`auction_bids`)

**Purpose**: Track all bids placed on auctions (Auctionhouse - Backend Indexer)

**Where it's used:**

#### Backend Indexer (`apps/backend/storage.js`):
- **`insertBid(bidData)`**: Store bid from BidEvent
- Also updates `auction_listings.currentBidAmount` and `currentBidder`

#### Backend Indexer (`apps/backend/index.js`):
- Monitors `BidEvent` events from marketplace contract

**Data Flow:**
1. Backend indexer detects `BidEvent` on-chain
2. Calls `insertBid()` to store bid in database
3. Updates listing's current bid information

**Current Status**: Schema exists and is actively used by backend indexer.

---

## Database Access Pattern

### Getting Database Connection

All routes use the same pattern:

```typescript
import { getDatabase } from '@repo/db';

const db = getDatabase();
```

### Common Operations

#### Insert
```typescript
const [record] = await db
  .insert(tableName)
  .values({ field1: value1, field2: value2 })
  .returning();
```

#### Select
```typescript
const records = await db
  .select()
  .from(tableName)
  .where(eq(tableName.field, value))
  .orderBy(desc(tableName.createdAt))
  .limit(10)
  .offset(0);
```

#### Update
```typescript
await db
  .update(tableName)
  .set({ field: newValue })
  .where(eq(tableName.id, recordId));
```

#### Delete
```typescript
await db
  .delete(tableName)
  .where(eq(tableName.id, recordId));
```

---

## Implementation Status

### ✅ Active (Used by Backend)
- ✅ Auction Listings (`auction_listings`) - Backend indexer actively stores events
- ✅ Auction Bids (`auction_bids`) - Backend indexer actively stores events

### 🚧 Schema Ready, Needs Implementation (Studio)
- 🚧 NFT Collections (`nft_collections`) - TODO in `/api/studio/contracts`
- 🚧 Collection Mints (`collection_mints`) - TODO in `/api/studio/nfts`

### 💤 Commented Out (Future Use)
- 💤 Subscription Cache (`subscriptions_cache`) - Will be used when implementing subscription features
- 💤 Subscriber Cache (`subscribers_cache`) - Will be used when implementing subscription features
- 💤 Clanker Tokens (`clanker_tokens`) - Not implemented yet
- 💤 Airdrop Lists (`airdrop_lists`) - Will be used in subscriptions section
- 💤 List Recipients (`list_recipients`) - Will be used in subscriptions section
- 💤 Airdrop History (`airdrop_history`) - Will be used in subscriptions section

---

## Next Steps for Studio Features

To complete the Studio app database integration:

1. **Implement NFT Collections Storage**
   - Update `/api/studio/contracts` POST to save to `nft_collections`
   - Add GET endpoint to fetch creator's collections

2. **Implement Collection Mints Storage**
   - Update `/api/studio/nfts` POST to save to `collection_mints`
   - Link mints to collections via `collectionId`
   - Add GET endpoint to fetch mints for a collection

3. **Add Collection Management UI**
   - Display deployed collections
   - Show mint history per collection
   - Link to contract on block explorer

---

## Related Documentation

- **Schema Definition**: `packages/db/src/schema.ts`
- **Database Client**: `packages/db/src/client.ts`
- **Backend Indexer**: `apps/backend/index.js` and `apps/backend/storage.js`
- **Environment Setup**: `ENVIRONMENT_SETUP.md`
