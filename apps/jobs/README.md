# @cryptoart/jobs

Background jobs and cron tasks for the Cryptoart platform.

## Overview

This is a UI-less Next.js app that hosts Vercel Cron routes for scheduled background jobs. It's deployed separately from the main apps (mvp, studio, social) to keep job logic isolated and independently scalable.

## Cron Routes

### `/api/cron/index-events` (Every minute)

Indexes blockchain events for marketplace contracts and factory-discovered collections.

**What it does:**
1. Polls marketplace contracts (Base + Ethereum) for new listings, bids, purchases, offers
2. Watches factory contracts for new collection deployments
3. Updates checkpoints in `indexed_contracts` table
4. Stores events in `chain_events` and domain tables (`listings`, `bids`, etc.)

**Authentication:** Vercel automatically sets `Authorization: Bearer ${CRON_SECRET}` header

**Configuration:**
```bash
# Database
STORAGE_POSTGRES_URL="postgresql://..."

# RPC URLs
CHAIN_8453_RPC_URL="https://mainnet.base.org" # Base
CHAIN_1_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY" # Ethereum

# Factory addresses (optional - for auto-discovery of new collections)
CHAIN_8453_FACTORY_ADDRESS="0x..." # ERC721 factory
CHAIN_8453_ERC1155_FACTORY_ADDRESS="0x..." # ERC1155 factory
CHAIN_8453_START_BLOCK="0" # Factory deploy block

# Cron secret (set in Vercel dashboard)
CRON_SECRET="your-secret-here"
```

## Development

```bash
# Install dependencies
pnpm install

# Run dev server (port 3002 to avoid conflicts)
pnpm dev

# Build
pnpm build

# Start production server
pnpm start
```

## Deployment

This app is deployed as a separate Vercel project. The `vercel.json` config defines cron schedules.

**Vercel Configuration:**
- Cron schedule: Every minute (`* * * * *`)
- Max duration: 60 seconds (requires Vercel Pro)
- Region: Auto (closest to database)

## Existing Crons (in mvp app)

The following cron routes currently live in `apps/mvp` and could be migrated here in the future:

### Active Crons
- `/api/cron/calculate-stats` - Platform statistics aggregation
- `/api/cron/featured-refresh` - Refresh featured listings
- `/api/cron/listing-previews` - Generate listing preview images
- `/api/cron/send-notifications` (if exists)

### Why Separate Jobs App?

1. **Isolation**: Job failures don't affect main app
2. **Scaling**: Jobs can scale independently
3. **Monitoring**: Separate error tracking and logs
4. **Deployment**: Can deploy job updates without touching main app
5. **Cost**: Easier to optimize function durations separately

## Migration Plan (Future)

To move existing crons from `mvp` to `jobs`:

1. Copy cron route file from `apps/mvp/src/app/api/cron/[name]`
2. Update imports to use workspace packages
3. Add cron config to `apps/jobs/vercel.json`
4. Test in staging
5. Deploy jobs app
6. Remove old cron route from mvp
7. Update vercel.json in mvp to remove cron schedule

## Monitoring

Key metrics to track:
- Execution duration (should stay under 60s)
- Events indexed per run
- Checkpoint lag (blocks behind chain head)
- Error rate
- RPC call failures

Add monitoring with:
```typescript
console.log('[Metrics]', {
  duration: Date.now() - startTime,
  eventsIndexed: results.reduce((sum, r) => sum + r.eventsIndexed, 0),
  checkpointLag: currentBlock - lastIndexedBlock,
});
```

## Troubleshooting

### Cron not running

- Check Vercel dashboard → Project → Cron Logs
- Verify CRON_SECRET is set correctly
- Ensure deployment is successful

### Events not indexing

- Check database connection (STORAGE_POSTGRES_URL)
- Verify RPC URLs are accessible
- Check for rate limiting errors
- Review checkpoint positions in `indexed_contracts` table

### Timeout errors

- Reduce MAX_BLOCK_RANGE in chain-indexer config
- Index fewer contracts per run
- Consider splitting into multiple cron routes

## Package Dependencies

- `@cryptoart/chain-indexer` - Event indexing logic
- `@cryptoart/db` - Database client and schema
- `next` - Next.js framework for API routes
- `react` - Required by Next.js (unused in routes)

## Related Documentation

- [Chain Indexer README](../../packages/chain-indexer/README.md)
- [Chain Indexer Migration Guide](../../packages/chain-indexer/MIGRATION-GUIDE.md)
- [Vercel Cron Documentation](https://vercel.com/docs/cron-jobs)
