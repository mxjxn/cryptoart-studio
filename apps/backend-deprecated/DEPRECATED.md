# Backend Indexer - DEPRECATED

## Status: Deprecated

This backend indexer has been deprecated in favor of The Graph subgraph-based indexing.

## Why Deprecated?

The subgraph approach provides several advantages:

1. **Automated Indexing**: The Graph Protocol handles all indexing infrastructure
2. **Library Event Support**: Subgraphs can properly index library events (MarketplaceLib, SettlementLib) by including library ABIs
3. **Scalability**: The Graph scales automatically with blockchain growth
4. **Efficient Queries**: GraphQL API with pre-processed, normalized data
5. **Industry Standard**: Used by major protocols for event indexing

## When Deprecated?

Deprecated on: 2025-01-XX

## Migration Path

### Old Approach (Backend)

The backend indexer manually scanned blocks and decoded library events by signature:

```javascript
// apps/backend/index.js
const libraryEventSignatures = {
  '0xa677084ea9aea69b2640d875bae622e3cf9d7c163f52d2f9d81daa1ed072c985': 'CreateListing',
  // ... more events
};
```

### New Approach (Subgraph)

Use the subgraph from `packages/auctionhouse-subgraph/`:

1. **Deploy Subgraph**: Follow instructions in `packages/auctionhouse-subgraph/README.md`
2. **Query via GraphQL**: Use the unified-indexer package to query the subgraph
3. **Update Config**: Set `AUCTIONHOUSE_BASE_MAINNET` in `packages/unified-indexer/src/config.ts`

### Example Migration

**Before (Backend):**
```javascript
// Manual block scanning
await scanBlockRange(provider, startBlock, endBlock);
```

**After (Subgraph):**
```typescript
// Query subgraph
import { queryListingsByTokenAddress } from '@cryptoart/unified-indexer';
const listings = await queryListingsByTokenAddress(chainId, tokenAddress);
```

## What Still Works?

This backend can still be used as a fallback or for development/testing purposes, but it is not recommended for production use.

## Related Files

- **Subgraph**: `packages/auctionhouse-subgraph/` - The Graph subgraph for event indexing
- **Unified Indexer**: `packages/unified-indexer/` - Query interface for subgraphs
- **Library Events Solution**: `packages/unified-indexer/LIBRARY_EVENTS_SOLUTION.md` - Explanation of library event handling

## Questions?

See the subgraph README or unified-indexer documentation for more information.

