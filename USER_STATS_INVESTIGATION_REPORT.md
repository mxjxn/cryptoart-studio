# User Stats Investigation Report

## Executive Summary

**Good news!** The system already has all the necessary data to create comprehensive user profile stats **without any smart contract changes**. The subgraph tracks all purchases, bids, and offers on-chain, and this data can be queried and aggregated to show user-specific statistics.

## Current State Analysis

### What We Have

1. **Subgraph Data** (`packages/auctionhouse-subgraph/schema.graphql`):
   - `Purchase` entities: Track all purchases with buyer, amount, count, listing info
   - `Bid` entities: Track all bids with bidder, amount, timestamp
   - `Offer` entities: Track all offers with offerer, amount, status (PENDING, ACCEPTED, RESCINDED)
   - `Listing` entities: Complete listing details including seller, token info, and status

2. **User API Endpoint** (`/api/user/[identifier]`):
   - Already fetches purchases by buyer address
   - Already fetches listings by seller address
   - Returns enriched data with metadata
   - Supports both Farcaster usernames and ETH addresses
   - Handles multiple verified wallets for Farcaster users

3. **Admin Stats** (`/admin/stats`):
   - Shows platform-wide statistics (total volume, fees, sales)
   - Uses `analyticsSnapshots` table for aggregated data
   - Currently only shows totals, not per-user breakdowns

4. **Database Schema** (`packages/db/src/schema.ts`):
   - `analyticsSnapshots`: Stores platform-wide stats by period
   - `userCache`: Stores user profiles with ETH addresses and verified wallets
   - No per-user stats table currently exists

### What's Missing

1. **User Stats Aggregation**:
   - No API endpoint to query user-specific stats
   - No database table to cache per-user statistics
   - Stats need to be calculated from subgraph data on-demand or cached

2. **UI Components**:
   - No stats section on user profile pages
   - No admin interface to view user stats

## Implementation Options

### Option 1: On-Demand Calculation (Simpler, Recommended for MVP)

Calculate stats in real-time when viewing a user profile by aggregating subgraph data.

**Pros:**
- No database schema changes needed
- Always shows real-time data
- Simpler to implement and maintain
- No cron jobs needed
- Automatic support for all users

**Cons:**
- Slightly slower page loads (requires subgraph queries)
- No historical trend data
- Multiple API calls per profile view

**Implementation Steps:**
1. Create new API endpoint: `/api/user/[identifier]/stats`
2. Query subgraph for user's purchases, bids, and sales
3. Aggregate data to calculate:
   - Total artworks sold (count)
   - Total artworks purchased (count)
   - Total ETH from sales (sum of amounts where user is seller)
   - Total ETH spent on purchases (sum of amounts where user is buyer)
   - Tokens sold (extract unique `erc20` addresses from listings as seller)
   - Tokens bought (extract unique `erc20` addresses from purchases as buyer)
4. Add stats section to user profile page
5. Optional: Add caching with short TTL (e.g., 5 minutes)

**Example Subgraph Queries Needed:**

```graphql
# Get all purchases by user (already implemented)
query PurchasesByBuyer($buyer: String!) {
  purchases(where: { buyer: $buyer }) {
    id
    amount
    count
    listing {
      erc20
      seller
      tokenAddress
      tokenId
    }
  }
}

# Get all sales by user (need to implement)
query SalesByUser($seller: String!) {
  purchases(where: { listing_: { seller: $seller } }) {
    id
    amount
    count
    buyer
    listing {
      erc20
      tokenAddress
      tokenId
    }
  }
}

# Get all bids by user (need to implement)
query BidsByUser($bidder: String!) {
  bids(where: { bidder: $bidder }) {
    id
    amount
    listing {
      listingId
      erc20
    }
  }
}
```

### Option 2: Cached Stats Table (More Complex, Better for Scale)

Store pre-calculated user stats in a database table, updated periodically.

**Pros:**
- Very fast page loads (just database lookup)
- Can track historical trends over time
- Reduced load on subgraph
- Better for large user bases

**Cons:**
- More complex implementation
- Database schema changes required
- Cron job needed for updates
- Stale data between updates
- Need to backfill historical data

**Implementation Steps:**
1. Create new table `userStats` in schema:
   ```typescript
   export const userStats = pgTable('user_stats', {
     userAddress: text('user_address').primaryKey().notNull(),
     // Sales stats
     totalArtworksSold: integer('total_artworks_sold').notNull().default(0),
     totalEthFromSales: text('total_eth_from_sales').notNull().default('0'),
     tokensSold: jsonb('tokens_sold'), // Array of ERC20 addresses
     // Purchase stats
     totalArtworksPurchased: integer('total_artworks_purchased').notNull().default(0),
     totalEthSpent: text('total_eth_spent').notNull().default('0'),
     tokensBought: jsonb('tokens_bought'), // Array of ERC20 addresses
     // Bid stats
     totalBidsPlaced: integer('total_bids_placed').notNull().default(0),
     totalBidsWon: integer('total_bids_won').notNull().default(0),
     // Timestamps
     lastUpdated: timestamp('last_updated').notNull(),
     createdAt: timestamp('created_at').defaultNow().notNull(),
   });
   ```

2. Create cron job `/api/cron/calculate-user-stats`
3. Implement stats calculation logic from subgraph
4. Create API endpoint to fetch cached stats
5. Add UI components to display stats
6. Run migration and backfill script

## Recommended Approach

**Start with Option 1 (On-Demand Calculation)**, then migrate to Option 2 if needed.

### Phase 1: Basic Stats (Week 1)

1. Create `/api/user/[identifier]/stats` endpoint
2. Query subgraph for:
   - Purchases where `buyer` matches user addresses
   - Purchases where `listing.seller` matches user addresses
3. Calculate basic metrics:
   - Count of artworks sold
   - Count of artworks purchased
   - Total ETH from sales
   - Total ETH spent on purchases
4. Add stats display to user profile page
5. Add similar stats to admin panel (if needed)

### Phase 2: Enhanced Stats (Week 2)

1. Add token-specific breakdowns:
   - List all ERC20 tokens used in sales
   - List all ERC20 tokens used in purchases
   - Show amounts per token
2. Add bid statistics:
   - Total bids placed
   - Bids won vs lost
   - Average bid amount
3. Add offer statistics:
   - Offers made
   - Offers received
   - Acceptance rate

### Phase 3: Optimization (Future)

1. Implement caching layer with Redis or database
2. Consider migrating to Option 2 if performance becomes an issue
3. Add historical trend graphs

## Data Availability Verification

All required data is available in the subgraph:

✅ **Number of artworks sold**: Count `Purchase` entities where `listing.seller` matches user
✅ **Number of artworks purchased**: Count `Purchase` entities where `buyer` matches user
✅ **Total ETH from sales**: Sum `Purchase.amount` where `listing.seller` matches user
✅ **Total ETH spent**: Sum `Purchase.amount` where `buyer` matches user
✅ **Tokens sold**: Extract unique `listing.erc20` from purchases as seller
✅ **Tokens bought**: Extract unique `listing.erc20` from purchases as buyer

## Smart Contract Changes Required

**NONE!** All necessary data is already being indexed by the subgraph from existing smart contract events:
- `PurchaseEvent`: Emitted on every purchase (captures buyer, seller via listing, amount)
- `BidEvent`: Emitted on every bid (captures bidder, amount)
- `OfferEvent`: Emitted on every offer (captures offerer, amount)
- `AcceptOfferEvent`: Emitted when offer accepted
- `RescindOfferEvent`: Emitted when offer rescinded

The smart contracts are already emitting all the events we need. We just need to query and aggregate the data the subgraph has already indexed.

## Implementation Checklist

### API Changes
- [ ] Create `/api/user/[identifier]/stats` endpoint
- [ ] Implement subgraph query for sales by user
- [ ] Implement subgraph query for token breakdown
- [ ] Add response caching (optional but recommended)

### UI Changes
- [ ] Add "Stats" tab to user profile page
- [ ] Create stats display component with:
  - Cards for sold/purchased counts
  - ETH amounts with USD conversion
  - Token breakdown lists
- [ ] Add stats section to admin panel (if needed)
- [ ] Ensure responsive design for mobile

### Testing
- [ ] Test with users who have no transactions
- [ ] Test with users who have many transactions
- [ ] Test with Farcaster users (multiple verified wallets)
- [ ] Test with ETH-only purchases
- [ ] Test with ERC20 token purchases
- [ ] Verify USD conversion accuracy

## Code Examples

### API Route Structure

```typescript
// apps/mvp/src/app/api/user/[identifier]/stats/route.ts
export async function GET(req: NextRequest, { params }: { params: Promise<{ identifier: string }> }) {
  const { identifier } = await params;
  
  // Resolve user addresses (reuse existing logic)
  const { primaryAddress, allAddresses } = await resolveUserAddresses(identifier);
  
  // Query subgraph for purchases as buyer
  const purchases = await queryPurchasesByBuyer(allAddresses);
  
  // Query subgraph for sales (purchases where listing.seller matches)
  const sales = await querySalesBySeller(allAddresses);
  
  // Aggregate data
  const stats = {
    artworksSold: sales.length,
    artworksPurchased: purchases.length,
    totalEthFromSales: sumAmounts(sales),
    totalEthSpent: sumAmounts(purchases),
    tokensSold: extractUniqueTokens(sales),
    tokensBought: extractUniqueTokens(purchases),
  };
  
  return NextResponse.json(stats);
}
```

### UI Component

```tsx
// Add to UserProfileClient.tsx
{activeTab === 'stats' && (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <StatCard
      title="Artworks Sold"
      value={stats.artworksSold}
    />
    <StatCard
      title="Artworks Purchased"
      value={stats.artworksPurchased}
    />
    <StatCard
      title="Total from Sales"
      value={`${formatEth(stats.totalEthFromSales)} ETH`}
      subtitle={formatUsd(stats.totalEthFromSales)}
    />
    <StatCard
      title="Total Spent"
      value={`${formatEth(stats.totalEthSpent)} ETH`}
      subtitle={formatUsd(stats.totalEthSpent)}
    />
  </div>
)}
```

## Estimated Effort

**Option 1 (Recommended):**
- API endpoint: 4-6 hours
- UI components: 3-4 hours
- Testing: 2-3 hours
- **Total: 1-2 days**

**Option 2 (If needed later):**
- Database schema: 2-3 hours
- Migration + backfill: 3-4 hours
- Cron job: 4-6 hours
- API updates: 2-3 hours
- **Total: 2-3 days additional**

## Conclusion

The claim that "a smart contract update is needed" is **incorrect**. All the necessary data is already available in the subgraph, which indexes events from the existing smart contracts. We can implement comprehensive user stats showing:

- Number of artworks sold and purchased
- Total ETH amounts for sales and purchases
- Token breakdowns (ETH and ERC20s)

This can be done **without any smart contract changes**, using only:
1. Existing subgraph data
2. New API endpoints for aggregation
3. UI components to display the stats

The recommended approach is to start with on-demand calculation (Option 1) for simplicity and speed of implementation, then migrate to cached stats (Option 2) only if performance becomes an issue as the user base grows.
