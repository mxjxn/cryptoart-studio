## Migration Guide: Subgraph → Chain Indexer

This document details how to migrate from the hosted subgraph to the new chain indexer.

## Current Subgraph Usage

### Files Consuming the Subgraph

Based on code analysis, the following files query the subgraph:

#### Core Query Files

1. **`apps/mvp/src/lib/subgraph.ts`**
   - `getActiveAuctions()` - Fetches active listings with pagination
   - `getAuction(listingId)` - Fetches single listing with bid history
   - `getAuctionsBySeller(address)` - User's created listings
   - `getAuctionsWithBids(address)` - Listings where user placed bids
   - `getAuctionsWithOffers(address)` - Listings where user made offers

2. **`apps/mvp/src/lib/server/browse-listings.ts`**
   - `BROWSE_LISTINGS_QUERY` - Main browse query with filters
   - `queryListingsAcrossChains()` - Multi-chain listing fetch
   - Enrichment pipeline: metadata, thumbnails, user discovery

3. **`apps/mvp/src/lib/server/subgraph-endpoints.ts`**
   - `getSubgraphEndpoint()` - Returns GraphQL endpoint URL
   - Supports Base + Ethereum mainnet

4. **`apps/mvp/src/lib/server/subgraph-multi-query.ts`**
   - Queries both Base and Ethereum subgraphs
   - Merges and sorts results across chains

#### API Routes Using Subgraph

- `/api/auctions/active` - Browse active listings
- `/api/auctions/[listingId]` - Get single auction
- `/api/auctions/by-seller/[address]` - Seller's listings
- `/api/auctions/with-bids/[address]` - User's bids
- `/api/auctions/with-offers/[address]` - User's offers
- `/api/cron/calculate-stats` - Platform statistics
- `/api/admin/listings` - Admin listing management

#### UI Components Using These APIs

- `HomePageClient.tsx`, `HomePageClientV2.tsx`
- `MarketClient.tsx`, `MarketRails.tsx`
- `AuctionCard.tsx`, `AuctionCardClient.tsx`
- `AuctionDetailClient.tsx`
- `CreateAuctionClient.tsx`
- `RecentListingsTable.tsx`

### Subgraph Query Patterns

The app uses two main query patterns:

1. **Client → API → Subgraph**: Browser fetches from Next.js API routes
2. **Server → Subgraph**: Server-side rendering queries subgraph directly

## Migration Approach

### Phase 1: Parallel Indexing (No App Changes)

**Goal**: Get the indexer running and backfilled without changing app queries

**Steps**:

1. Deploy indexer package
2. Run migration: `psql $STORAGE_POSTGRES_URL < packages/chain-indexer/migrations/001-create-indexer-tables.sql`
3. Add Vercel cron route (see below)
4. Backfill historical events:
   ```typescript
   import { backfillContract, MARKETPLACE_CONTRACTS } from '@cryptoart/chain-indexer';
   for (const config of MARKETPLACE_CONTRACTS) {
     await backfillContract(config);
   }
   ```
5. Monitor checkpoint progress vs. subgraph

**Timeline**: 1-2 days (mostly backfill time)

**Risk**: Low - no app changes yet

### Phase 2: Create Indexer Read Adapters

**Goal**: Build equivalent queries using indexer tables

**Steps**:

1. Create `apps/mvp/src/lib/server/indexer-queries.ts`:

```typescript
import { db } from '@cryptoart/db/client';
import { listings, bids, purchases, offers } from '@cryptoart/chain-indexer';
import { sql } from 'drizzle-orm';

/**
 * Get active listings (equivalent to getActiveAuctions)
 */
export async function getActiveListingsFromIndexer(options: {
  chainId?: number;
  first?: number;
  skip?: number;
}) {
  const { chainId, first = 16, skip = 0 } = options;

  const query = db
    .select()
    .from(listings)
    .where(sql`${listings.status} = 'ACTIVE'`)
    .orderBy(sql`${listings.createdAt} DESC`)
    .limit(first)
    .offset(skip);

  if (chainId) {
    query.where(sql`${listings.chainId} = ${chainId}`);
  }

  return await query;
}

/**
 * Get single listing with bids (equivalent to getAuction)
 */
export async function getListingFromIndexer(
  listingId: string,
  chainId: number
) {
  const [listing] = await db
    .select()
    .from(listings)
    .where(
      sql`${listings.chainId} = ${chainId} AND ${listings.listingId} = ${BigInt(listingId)}`
    )
    .limit(1);

  if (!listing) return null;

  const listingBids = await db
    .select()
    .from(bids)
    .where(
      sql`${bids.chainId} = ${chainId} AND ${bids.listingId} = ${BigInt(listingId)}`
    )
    .orderBy(sql`${bids.timestamp} DESC`);

  return {
    ...listing,
    bids: listingBids,
  };
}

/**
 * Get listings by seller (equivalent to getAuctionsBySeller)
 */
export async function getListingsBySellerFromIndexer(
  seller: string,
  options: { first?: number; skip?: number } = {}
) {
  const { first = 100, skip = 0 } = options;
  const normalizedSeller = seller.toLowerCase();

  return await db
    .select()
    .from(listings)
    .where(sql`${listings.seller} = ${normalizedSeller}`)
    .orderBy(sql`${listings.createdAt} DESC`)
    .limit(first)
    .offset(skip);
}

/**
 * Get listings where user has placed bids (equivalent to getAuctionsWithBids)
 */
export async function getListingsWithBidsByUserFromIndexer(
  bidder: string,
  options: { first?: number; skip?: number } = {}
) {
  const { first = 100, skip = 0 } = options;
  const normalizedBidder = bidder.toLowerCase();

  // Get distinct listing IDs where user has bid
  const userBids = await db
    .selectDistinct({ chainId: bids.chainId, listingId: bids.listingId })
    .from(bids)
    .where(sql`${bids.bidder} = ${normalizedBidder}`);

  if (userBids.length === 0) return [];

  // Fetch full listings
  const listingIds = userBids.map((b) => `(${b.chainId}, ${b.listingId})`).join(',');
  return await db
    .select()
    .from(listings)
    .where(sql.raw(`(chain_id, listing_id) IN (${listingIds})`))
    .orderBy(sql`${listings.updatedAt} DESC`)
    .limit(first)
    .offset(skip);
}

/**
 * Get listings where user has made offers (equivalent to getAuctionsWithOffers)
 */
export async function getListingsWithOffersByUserFromIndexer(
  offerer: string,
  options: { first?: number; skip?: number } = {}
) {
  const { first = 100, skip = 0 } = options;
  const normalizedOfferer = offerer.toLowerCase();

  // Get distinct listing IDs where user has made offers
  const userOffers = await db
    .selectDistinct({ chainId: offers.chainId, listingId: offers.listingId })
    .from(offers)
    .where(sql`${offers.offerer} = ${normalizedOfferer}`);

  if (userOffers.length === 0) return [];

  // Fetch full listings
  const listingIds = userOffers.map((o) => `(${o.chainId}, ${o.listingId})`).join(',');
  return await db
    .select()
    .from(listings)
    .where(sql.raw(`(chain_id, listing_id) IN (${listingIds})`))
    .orderBy(sql`${listings.updatedAt} DESC`)
    .limit(first)
    .offset(skip);
}
```

2. Add feature flag to `.env`:
   ```
   USE_CHAIN_INDEXER=false
   ```

3. Create wrapper that switches between subgraph and indexer:

```typescript
// apps/mvp/src/lib/server/listing-queries.ts
import { getActiveListingsFromIndexer } from './indexer-queries';
import { getActiveAuctionsFromSubgraph } from './subgraph';

export async function getActiveListings(options: any) {
  if (process.env.USE_CHAIN_INDEXER === 'true') {
    return getActiveListingsFromIndexer(options);
  }
  return getActiveAuctionsFromSubgraph(options);
}
```

**Timeline**: 3-5 days

**Risk**: Medium - requires careful query translation

### Phase 3: Validation & Testing

**Goal**: Verify indexer results match subgraph

**Steps**:

1. Add validation logging:
   ```typescript
   const subgraphResults = await getActiveAuctionsFromSubgraph(options);
   const indexerResults = await getActiveListingsFromIndexer(options);
   
   if (subgraphResults.length !== indexerResults.length) {
     console.warn('[Validation] Result count mismatch', {
       subgraph: subgraphResults.length,
       indexer: indexerResults.length,
     });
   }
   ```

2. Run comparison script on production data
3. Test all user-facing features:
   - Browse market page
   - View auction detail
   - User profile (my listings/bids)
   - Admin tools
4. Load test to ensure performance is acceptable

**Timeline**: 2-3 days

**Risk**: Medium - may discover edge cases

### Phase 4: Gradual Rollout

**Goal**: Switch production traffic to indexer

**Steps**:

1. Enable for 10% of requests:
   ```typescript
   const useIndexer = Math.random() < 0.1 || process.env.USE_CHAIN_INDEXER === 'true';
   ```

2. Monitor error rates and performance
3. Increase to 25%, 50%, 100% over 1-2 weeks
4. Keep subgraph as fallback during rollout:
   ```typescript
   try {
     return await getActiveListingsFromIndexer(options);
   } catch (error) {
     console.error('[Indexer] Fallback to subgraph', error);
     return await getActiveAuctionsFromSubgraph(options);
   }
   ```

**Timeline**: 1-2 weeks

**Risk**: Low - gradual rollout with fallback

### Phase 5: Cleanup

**Goal**: Remove subgraph dependencies

**Steps**:

1. Remove subgraph query code
2. Remove GraphQL dependencies
3. Remove subgraph environment variables
4. Cancel hosted subgraph subscription
5. Archive `packages/auctionhouse-subgraph`

**Timeline**: 1 day

**Risk**: Low - only after full rollout

## Schema Mapping

### Subgraph → Indexer

| Subgraph Field | Indexer Field | Notes |
|----------------|---------------|-------|
| `listing.id` | `listings.listing_id` | Use as string: `listing.listingId.toString()` |
| `listing.chainId` | `listings.chain_id` | Added by indexer (not in subgraph) |
| `listing.seller` | `listings.seller` | Lowercase hex |
| `listing.tokenAddress` | `listings.token_address` | Lowercase hex |
| `listing.tokenId` | `listings.token_id` | BigInt |
| `listing.status` | `listings.status` | 'ACTIVE', 'CANCELLED', 'FINALIZED' |
| `listing.hasBid` | `listings.has_bid` | Boolean as integer (0/1) |
| `listing.bids` | Join `bids` table | `WHERE bids.listing_id = listings.listing_id` |
| `listing.purchases` | Join `purchases` table | `WHERE purchases.listing_id = listings.listing_id` |

### Type Conversions

- **BigInt Fields**: Subgraph returns strings, indexer uses native BigInt
  ```typescript
  // Subgraph
  amount: "1000000000000000000" // string
  
  // Indexer
  amount: 1000000000000000000n // bigint
  ```

- **Addresses**: Always lowercase in indexer
  ```typescript
  // Subgraph may return mixed case
  seller: "0xAbC123..."
  
  // Indexer always lowercase
  seller: "0xabc123..."
  ```

- **Booleans**: Indexer uses integers (0/1) for PostgreSQL compatibility
  ```typescript
  // Subgraph
  hasBid: true // boolean
  
  // Indexer
  hasBid: 1 // integer
  
  // Convert when reading
  const hasBid = listing.has_bid === 1;
  ```

## Performance Considerations

### Indexing Performance

- **Subgraph**: ~1-5 minute delay after block confirmation
- **Indexer**: ~1-3 minute delay (with every-minute cron)
- **Backfill**: ~10-50 blocks/second depending on RPC and events

### Query Performance

- **Subgraph**: Optimized GraphQL with specialized indexes
- **Indexer**: Raw Postgres with standard indexes
- **Recommendation**: Add covering indexes for hot queries

Example indexes to add:

```sql
-- Browse active listings
CREATE INDEX listings_active_browse_idx 
ON listings(status, created_at DESC) 
WHERE status = 'ACTIVE';

-- User's active bids
CREATE INDEX bids_user_active_idx 
ON bids(bidder, timestamp DESC);

-- Listing with latest bid
CREATE INDEX bids_listing_latest_idx 
ON bids(chain_id, listing_id, timestamp DESC);
```

### Database Size

- **Raw events**: ~500 bytes/event average
- **Domain tables**: ~300 bytes/listing, ~100 bytes/bid
- **Estimate**: ~100k events/month = ~50MB/month
- **Retention**: Consider archiving old events after 6-12 months

## Rollback Plan

If issues arise during migration:

1. **Immediate**: Set `USE_CHAIN_INDEXER=false`
2. **Next Deploy**: Revert to subgraph-only code
3. **Cleanup**: Keep indexer tables for future retry

The rollback is safe because:
- Subgraph queries remain unchanged
- No data loss (indexer runs in parallel)
- Feature flag provides instant cutover

## Testing Checklist

- [ ] Indexer is caught up to chain head (< 10 blocks behind)
- [ ] Checkpoint advances every cron run
- [ ] Active listings match between subgraph and indexer
- [ ] Listing detail page loads correctly
- [ ] User profile shows correct listings/bids
- [ ] Browse/filter works across chains
- [ ] Admin tools function correctly
- [ ] Performance is acceptable (< 500ms for listing queries)
- [ ] Error handling works (indexer failure doesn't break app)
- [ ] Monitoring/alerting is in place

## Open Questions for Max

1. **Timing**: When to start the migration? (After social features ship?)

2. **Rollout**: Prefer gradual rollout or switch all at once?

3. **Subgraph**: Keep as paid backup for 1-2 months, or cancel immediately?

4. **New Contracts**: Should the indexer also handle:
   - NFT factory events (minting, transfers)?
   - LSSVM pool events?
   - STP v2 subscription events?
   Or keep those separate?

5. **Performance**: Are there specific query patterns that need optimization?

6. **Monitoring**: What metrics are most important? (Lag, error rate, query speed?)

7. **Backfill**: Run backfill on local/staging first, or directly on production DB?
