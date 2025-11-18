# Creator Core Indexer Deployment

## Overview

The Creator Core Indexer is a background service that continuously monitors the blockchain for Creator Core contract deployments, mints, transfers, and metadata.

## Deployment Options

### Option 1: Standalone Service (Recommended)

Run as a standalone Node.js service:

```bash
cd packages/creator-core-indexer
npm run build
npm run start
```

### Option 2: Docker Container

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

### Option 3: Vercel Cron Job

Create a Vercel cron job that runs the indexer periodically:

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/index-creator-core",
    "schedule": "*/5 * * * *" // Every 5 minutes
  }]
}
```

### Option 4: Background Worker (Railway, Render, etc.)

Deploy as a background worker service on platforms like Railway or Render.

## Environment Variables

Required:
- `POSTGRES_URL`: Shared Postgres connection string
- `RPC_URL`: Base network RPC endpoint

Optional:
- `CHAIN_ID`: Chain ID (default: 8453)
- `START_BLOCK`: Block number to start from
- `BATCH_SIZE`: Blocks per batch (default: 100)
- `POLL_INTERVAL`: Polling interval in ms (default: 12000)
- `ERC721_IMPLEMENTATION_ADDRESSES`: Comma-separated ERC721 implementation addresses
- `ERC1155_IMPLEMENTATION_ADDRESSES`: Comma-separated ERC1155 implementation addresses
- `ERC6551_IMPLEMENTATION_ADDRESSES`: Comma-separated ERC6551 implementation addresses

## Monitoring

### Health Check Endpoint

Create a health check endpoint to monitor indexer status:

```typescript
// GET /api/indexer/health
{
  "status": "running",
  "lastProcessedBlock": 12345678,
  "currentBlock": 12345680,
  "blocksBehind": 2
}
```

### Logging

The indexer logs:
- Block processing progress
- New contracts discovered
- Errors and retries
- Metadata fetching status

### Metrics to Monitor

- Blocks processed per minute
- Contracts indexed
- Tokens indexed
- Metadata fetch success rate
- Error rate
- Database connection health

## Scaling

For high-volume indexing:
- Increase `BATCH_SIZE` for faster processing
- Decrease `POLL_INTERVAL` for more frequent updates
- Use multiple indexer instances with different block ranges
- Consider using a message queue for event processing

## Troubleshooting

### Indexer Not Starting

- Check `POSTGRES_URL` is set correctly
- Verify `RPC_URL` is accessible
- Check database schema is up to date

### Missing Contracts

- Verify implementation addresses are configured
- Check if contracts were deployed before `START_BLOCK`
- Manually trigger contract detection for specific addresses

### Slow Indexing

- Increase `BATCH_SIZE`
- Use a faster RPC endpoint
- Optimize database queries with proper indexes

