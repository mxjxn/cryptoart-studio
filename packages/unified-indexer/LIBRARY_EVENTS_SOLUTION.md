# Solution: Handling Library Events in Auctionhouse Subgraph

## The Problem

The Auctionhouse marketplace contract uses `MarketplaceLib.sol` as an external library. This library emits critical events like:
- `CreateListing`
- `CreateListingTokenDetails`
- `CreateListingFees`
- `PurchaseEvent`
- `BidEvent`
- `ModifyListing`
- `CancelListing`
- `FinalizeListing`

**Challenge**: These events are emitted by the library, not the main contract. When libraries emit events, they appear in the transaction logs as if they came from the calling contract (the marketplace contract), but they're not part of the main contract's ABI.

## The Solution: Subgraph-Based Indexing

Instead of trying to query these events directly from the contract ABI (which would fail because they're not in the main contract ABI), we use **The Graph subgraph** to index these events.

### How It Works

1. **Subgraph Configuration**: The subgraph listens to the marketplace contract address and indexes all events emitted from that address, including library events.

2. **Event Emission**: When `MarketplaceLib` functions are called through the marketplace contract:
   ```solidity
   // In MarketplaceLib.sol (library)
   emit CreateListing(listingId, ...);
   ```
   The event appears in the transaction logs with the marketplace contract as the emitter address.

3. **Subgraph Indexing**: The subgraph can index these events because:
   - Events are indexed by contract address, not by ABI
   - The subgraph includes the MarketplaceLib ABI in its configuration
   - Event handlers are set up to process these library events

4. **GraphQL Query**: Our unified-indexer queries the subgraph via GraphQL, which has already processed and indexed all the library events.

### Implementation Details

In `packages/unified-indexer/src/auctionhouse-queries.ts`:

```typescript
// We query the subgraph, not the contract directly
const data = await request<{ listings: AuctionData[] }>(
  endpoint, 
  LISTINGS_BY_TOKEN_ADDRESS_QUERY, 
  { tokenAddress: tokenAddress.toLowerCase() }
)
```

The subgraph has already:
- Indexed all `CreateListing` events (from MarketplaceLib)
- Processed `CreateListingTokenDetails` and `CreateListingFees` events
- Linked related events together
- Created normalized entities (Listings, Purchases, Bids)

### Why This Works

1. **Subgraphs index by address, not ABI**: The subgraph listens to all events emitted from the marketplace contract address, regardless of whether they're in the main contract ABI or a library ABI.

2. **Library ABIs included**: The subgraph configuration includes both:
   - The main Marketplace contract ABI
   - The MarketplaceLib library ABI

3. **Event handlers process library events**: The subgraph's event handlers are configured to process events from MarketplaceLib, creating entities from the library events.

### Benefits

- ✅ No need to manually filter library events from transaction logs
- ✅ Pre-processed and normalized data
- ✅ Efficient GraphQL queries
- ✅ Handles complex event relationships automatically
- ✅ Works even though library events aren't in main contract ABI

### Alternative Approaches (Not Used)

1. **Direct Event Filtering**: Could use `viem` or `ethers` to filter events directly, but would need to:
   - Include MarketplaceLib ABI separately
   - Manually filter and process events
   - Handle event relationships manually
   - Less efficient for queries

2. **Hybrid Approach**: Use subgraph for queries, direct filtering for real-time updates. Not implemented but could be added if needed.

## Configuration

The subgraph endpoint is configured in:
- `packages/unified-indexer/src/auctionhouse-queries.ts` - Query functions
- `packages/unified-indexer/src/config.ts` - Centralized config

**Note**: The subgraph must be deployed and include MarketplaceLib ABI in its configuration for this to work.

