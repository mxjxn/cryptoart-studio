# @cryptoart/chain-indexer

Vercel-based chain event indexer that replaces the hosted subgraph for the cryptoart-studio marketplace. Uses polling with viem to index events from Base and Ethereum mainnet auction contracts, storing them in Postgres for efficient querying.

## Overview

This package provides:

- **Polling-based indexing**: Fetches events from EVM chains using viem's `getLogs`
- **Chunked block ranges**: Processes blocks in configurable chunks to respect RPC limits
- **Checkpoint tracking**: Reuses shared `indexed_contracts` table from @cryptoart/db
- **Factory discovery**: Watches factory contracts for new collections and auto-indexes them
- **Idempotent storage**: Unique constraints prevent duplicate events on reindexes
- **Reorg safety**: Stays a few blocks behind chain head to avoid reorg issues
- **Domain models**: Transforms raw events into listings, bids, purchases, etc.

## Integration with collection-indexer

This package works alongside `@cryptoart/collection-indexer`:
- **collection-indexer**: Indexes NFT events (Transfer, metadata) from factory-discovered collections
- **chain-indexer**: Indexes marketplace events (listings, bids, purchases) from marketplace contracts
- Both share the `indexed_contracts` table for checkpoint tracking
- Both watch factory contracts to discover new collections

## Architecture

### Data Flow

```
Chain (Base/Ethereum) 
  → RPC (viem.getLogs) 
  → Chunked Fetching 
  → Event Parsing 
  → Postgres (raw events + domain tables) 
  → Checkpoint Update
```

### Tables

**Shared with collection-indexer:**
- `indexed_contracts` - Checkpoint tracking for all contracts (marketplace, factory, collections)

**Marketplace-specific:**
- `chain_events` - Raw event storage (all events as JSONB)
- `listings` - Marketplace listings (CreateListing events)
- `bids` - All bids on listings
- `purchases` - All purchases on listings
- `offers` - All offers on listings (PENDING/ACCEPTED/RESCINDED)
- `escrows` - Settlement escrow events

### Idempotency

Events are uniquely identified by `(chain_id, transaction_hash, log_index)`. Duplicate inserts are ignored via `ON CONFLICT DO NOTHING`, making reindexing safe.

### Reorg Handling

The indexer stays 3 blocks behind the chain head by default (configurable). This handles most reorgs. For deeper reorgs, manual intervention may be needed (see Troubleshooting).

## Setup

### 1. Install Dependencies

```bash
cd packages/chain-indexer
pnpm install
```

### 2. Configure Environment Variables

Add to your `.env` or `.env.local`:

```bash
# Database (shared with main app)
STORAGE_POSTGRES_URL="postgresql://..."

# RPC URLs
BASE_RPC_URL="https://mainnet.base.org"
ETH_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"

# Or use generic names
RPC_URL_BASE="https://mainnet.base.org"
RPC_URL_MAINNET="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
ALCHEMY_API_KEY="YOUR_KEY"

# Cron Secret (for securing the Vercel Cron route)
CRON_SECRET="your-secret-here"
```

### 3. Run Database Migrations

The chain-indexer uses migrations in `packages/db/migrations/`:
- `0030_chain_events.sql` - Raw event storage
- `0031_marketplace_listings.sql` - Listings domain table
- `0032_marketplace_events.sql` - Bids, purchases, offers, escrows

```bash
# From repo root
cd packages/db

# Run migrations in order
psql $STORAGE_POSTGRES_URL < migrations/0030_chain_events.sql
psql $STORAGE_POSTGRES_URL < migrations/0031_marketplace_listings.sql
psql $STORAGE_POSTGRES_URL < migrations/0032_marketplace_events.sql

# Or use your preferred migration tool
```

**Note:** The `indexed_contracts` table already exists from migration `0023_add_collection_tables.sql`. Chain-indexer reuses this table for marketplace contract checkpoints.

### 4. Initial Backfill (Optional)

For local testing or initial setup, you can backfill events from contract deploy blocks:

```typescript
import { backfillContract, MARKETPLACE_CONTRACTS } from '@cryptoart/chain-indexer';

// Backfill Base marketplace from deploy block
await backfillContract(MARKETPLACE_CONTRACTS[0]);

// Or backfill all contracts
for (const config of MARKETPLACE_CONTRACTS) {
  await backfillContract(config);
}
```

**Note**: Backfilling thousands of blocks can take time and may hit RPC rate limits. Consider running in chunks or using a dedicated backfill script.

## Usage

### Vercel Cron Route

**The cron route now lives in `apps/jobs`**, a dedicated Next.js app for background jobs.

See [`apps/jobs/README.md`](../../apps/jobs/README.md) for:
- Full cron route implementation
- Vercel configuration
- Environment variables
- Deployment instructions
- Monitoring guidance

The jobs app handles:
1. Indexing marketplace contracts
2. Watching factory contracts for new collections
3. Auto-indexing marketplace events on discovered collections

**Note**: Vercel Pro allows cron jobs as frequent as once per minute. Free tier is limited to daily.

### Programmatic Usage

```typescript
import {
  indexContract,
  indexAllContracts,
  getCheckpoint,
  MARKETPLACE_CONTRACTS,
} from '@cryptoart/chain-indexer';

// Index a single contract
const baseMarketplace = MARKETPLACE_CONTRACTS[0];
const result = await indexContract(baseMarketplace);
console.log(`Indexed ${result.eventsIndexed} events`);

// Check current checkpoint
const checkpoint = await getCheckpoint(8453, baseMarketplace.address);
console.log(`Last indexed block: ${checkpoint}`);

// Index all contracts in parallel
const results = await indexAllContracts(MARKETPLACE_CONTRACTS, {
  parallel: true,
});
```

### Querying Indexed Data

```typescript
import { db } from '@cryptoart/db/client';
import { listings, bids, purchases } from '@cryptoart/chain-indexer';
import { sql } from 'drizzle-orm';

// Get active listings on Base
const activeListings = await db
  .select()
  .from(listings)
  .where(
    sql`${listings.chainId} = 8453 AND ${listings.status} = 'ACTIVE'`
  )
  .orderBy(sql`${listings.createdAt} DESC`)
  .limit(20);

// Get bids for a listing
const listingBids = await db
  .select()
  .from(bids)
  .where(
    sql`${bids.chainId} = 8453 AND ${bids.listingId} = 123`
  )
  .orderBy(sql`${bids.timestamp} DESC`);

// Get purchases by buyer
const buyerPurchases = await db
  .select()
  .from(purchases)
  .where(sql`${purchases.buyer} = '0x...'`)
  .orderBy(sql`${purchases.timestamp} DESC`);
```

## Adding New Contracts

To index additional contracts (NFT factories, LSSVM pools, STP contracts):

1. **Add ABI**: Copy ABI JSON to `src/config/abis/`
2. **Import ABI**: Create TypeScript wrapper in `src/config/abis/YourContract.ts`
3. **Add Config**: Add contract config to `src/config/contracts.ts`:

```typescript
export const NEW_CONTRACTS: ContractConfig[] = [
  {
    chainId: 8453,
    address: '0x...' as Address,
    startBlock: 12345678n,
    abi: YourContractABI,
    events: ['EventName1', 'EventName2'],
    label: 'Your Contract (Base)',
  },
];

export const ALL_CONTRACTS: ContractConfig[] = [
  ...MARKETPLACE_CONTRACTS,
  ...SETTLEMENT_CONTRACTS,
  ...NEW_CONTRACTS,
];
```

4. **Add Processors** (optional): If you need domain tables, add processors in `src/indexer/processors.ts`
5. **Update Migration** (optional): If adding domain tables, create a new migration SQL file

## Configuration

### RPC Rate Limits

Adjust `MAX_BLOCK_RANGE` in `src/indexer/indexer.ts` based on your RPC provider:

- **Alchemy/Infura**: 2000-10000 blocks (default: 2000)
- **Public endpoints**: 500-1000 blocks
- **Self-hosted**: Higher limits possible

### Reorg Safety Margin

Adjust safety margin in `src/indexer/client.ts`:

```typescript
export async function getSafeBlockNumber(chainId: number, safetyMargin = 3): Promise<bigint> {
  // Change safetyMargin to 5 or 10 for deeper reorg protection
}
```

### Polling Frequency

Vercel Cron can run as often as every minute on Pro plans. Adjust based on:

- **Every minute**: Near real-time indexing (Base/Ethereum settle ~12s/12s)
- **Every 5 minutes**: Less frequent polling, lower costs
- **Every hour**: Batch processing, minimal costs

## Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

Tests cover:

- Block range chunking logic
- Checkpoint initialization and updates
- Idempotency (duplicate event handling)
- Reorg safety margin calculations
- Error handling and retry logic

## Migration from Subgraph

### Current Subgraph Consumers

Based on code analysis, the app queries the subgraph from:

1. **Client Queries** (`apps/mvp/src/lib/subgraph.ts`):
   - `getActiveAuctions()` - Browse active listings
   - `getAuction(listingId)` - Single listing detail
   - `getAuctionsBySeller(address)` - User's listings
   - `getAuctionsWithBids(address)` - User's bids
   - `getAuctionsWithOffers(address)` - User's offers

2. **Server Queries** (`apps/mvp/src/lib/server/browse-listings.ts`):
   - `BROWSE_LISTINGS_QUERY` - Main browse with filters
   - Enrichment with metadata, thumbnails, user info

### Migration Strategy

#### Phase 1: Parallel Operation (Recommended)

1. **Deploy indexer** with Vercel Cron running
2. **Backfill** historical events to catch up with subgraph
3. **Add read paths** that query both indexer and subgraph
4. **Validate** that results match
5. **Monitor** for discrepancies

#### Phase 2: Gradual Cutover

1. **Feature flag** new read paths using indexer tables
2. **A/B test** with percentage of traffic
3. **Monitor** performance and correctness
4. **Increase** percentage over time

#### Phase 3: Full Cutover

1. **Switch** all reads to indexer tables
2. **Remove** subgraph queries and dependencies
3. **Cancel** hosted subgraph subscription
4. **Clean up** old code

### Query Translation

**Subgraph Query:**
```graphql
query {
  listings(where: { status: "ACTIVE" }, orderBy: createdAt, orderDirection: desc) {
    id
    listingId
    seller
    tokenAddress
    tokenId
    initialAmount
    startTime
    endTime
  }
}
```

**Indexer Query:**
```typescript
const activeListings = await db
  .select({
    id: listings.listingId,
    listingId: listings.listingId,
    seller: listings.seller,
    tokenAddress: listings.tokenAddress,
    tokenId: listings.tokenId,
    initialAmount: listings.initialAmount,
    startTime: listings.startTime,
    endTime: listings.endTime,
  })
  .from(listings)
  .where(sql`${listings.status} = 'ACTIVE'`)
  .orderBy(sql`${listings.createdAt} DESC`);
```

### Differences from Subgraph

| Feature | Subgraph | Indexer |
|---------|----------|---------|
| Update latency | ~1-5 min | ~1 min (with cron) |
| Query language | GraphQL | SQL (Drizzle) |
| Reorg handling | Automatic | 3-block safety margin |
| Cost | ~$100-500/mo | Vercel Pro included |
| Custom logic | Limited | Full TypeScript |
| Backfill | Automatic | Manual initial run |

## Troubleshooting

### Indexer is Behind Chain Head

**Symptoms**: Checkpoint is many blocks behind current block

**Causes**:
- Cron not running (check Vercel Deployments > Cron Logs)
- RPC rate limiting (check for errors in logs)
- Database connection issues
- Large block range taking too long

**Fixes**:
- Verify cron secret is correct
- Check RPC provider rate limits and upgrade if needed
- Reduce `MAX_BLOCK_RANGE` to process smaller chunks
- Run manual backfill to catch up faster

### Events Are Missing

**Symptoms**: Checkpoint updated but events not in tables

**Causes**:
- Events filtered by wrong addresses
- ABI mismatch (event signature changed)
- Transaction reverted (no events emitted)

**Fixes**:
- Verify contract addresses match `networks.json`
- Check ABI matches deployed contract
- Query `chain_events` table to see raw events
- Check block explorer for expected events

### Duplicate Events

**Symptoms**: Same event inserted multiple times

**Causes**:
- Race condition (multiple cron jobs running)
- Checkpoint not updated atomically
- Database constraint not applied

**Fixes**:
- Verify unique constraint on `(chain_id, transaction_hash, log_index)`
- Check for multiple cron jobs running simultaneously
- Ensure checkpoint updates happen in same transaction as event inserts

### Deep Reorg Detected

**Symptoms**: Events for blocks beyond checkpoint need reprocessing

**Causes**:
- Chain reorganization deeper than safety margin
- Network split or consensus failure

**Fixes**:
- Manually reset checkpoint to before reorg: 
  ```sql
  UPDATE indexer_checkpoints 
  SET last_block = SAFE_BLOCK_NUMBER 
  WHERE chain_id = CHAIN_ID AND contract = 'CONTRACT_ADDRESS';
  ```
- Delete affected events:
  ```sql
  DELETE FROM chain_events 
  WHERE chain_id = CHAIN_ID AND block_number > SAFE_BLOCK_NUMBER;
  
  -- Also delete from domain tables
  DELETE FROM bids WHERE chain_id = CHAIN_ID AND block_number > SAFE_BLOCK_NUMBER;
  DELETE FROM purchases WHERE chain_id = CHAIN_ID AND block_number > SAFE_BLOCK_NUMBER;
  -- etc.
  ```
- Let indexer re-process from safe checkpoint

### Performance Issues

**Symptoms**: Cron timeouts, slow queries

**Causes**:
- Large block ranges
- Missing indexes
- RPC latency

**Fixes**:
- Reduce `MAX_BLOCK_RANGE`
- Add indexes on commonly queried columns
- Use faster RPC provider
- Consider upgrading Vercel plan for longer function timeouts

## Development

### Project Structure

```
packages/chain-indexer/
├── src/
│   ├── config/           # Contract configs and ABIs
│   │   ├── abis/         # Contract ABI JSON files
│   │   └── contracts.ts  # Contract configurations
│   ├── indexer/          # Core indexing logic
│   │   ├── client.ts     # RPC client setup
│   │   ├── database.ts   # Database operations
│   │   ├── indexer.ts    # Main indexing logic
│   │   └── processors.ts # Event processors
│   ├── types/            # TypeScript types
│   │   └── events.ts     # Event type definitions
│   ├── schema.ts         # Database schema (Drizzle)
│   └── index.ts          # Main exports
├── migrations/           # SQL migrations
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Adding Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('YourFeature', () => {
  it('should do something', () => {
    // Test implementation
  });
});
```

### Type Checking

```bash
pnpm check-types
```

## Monitoring

Key metrics to monitor:

- **Checkpoint lag**: Blocks behind chain head per contract
- **Indexing speed**: Events per minute
- **Error rate**: Failed cron runs or RPC errors
- **Query performance**: Database query times

Consider adding metrics to your cron route:

```typescript
console.log('[Metrics]', {
  chainId: result.chainId,
  contract: result.contract,
  blocksBehind: currentBlock - result.endBlock,
  eventsPerSecond: result.eventsIndexed / (result.timeTaken / 1000),
  timeTaken: result.timeTaken,
});
```

## License

Private - Part of cryptoart-studio monorepo
