# Backend API Setup

This backend provides an API server for the auctionhouse mini app.

## Current Status

✅ Database schema created (`packages/db/src/schema.ts`)
- `auctionListings` table - stores all auction listings
- `auctionBids` table - stores bid history

✅ API server structure created (`apps/backend/api.js`)
- Express server with endpoints
- Placeholder implementations ready for database integration

✅ Frontend updated to use API (`apps/auctionhouse/src/hooks/useApi.ts`)
- `useActiveAuctions` hook fetches from `/api/listings/active`
- Auto-refreshes every 30 seconds

## Next Steps

### 1. Database Migration

Run database migration to create the new tables:

```bash
cd packages/db
pnpm db:generate  # Generate migration files
pnpm db:push      # Push schema to database
```

### 2. Connect Database to Backend

The backend needs to import the database package. Update `apps/backend/api.js`:

```javascript
const { getDatabase, auctionListings, auctionBids } = require('@repo/db');
const { eq, and, gt, desc } = require('drizzle-orm');
```

And implement the actual database queries in the endpoints.

### 3. Update Indexer to Store Events

Update `apps/backend/index.js` to:
- Decode CreateListing events properly
- Store listings in database using `upsertListing()`
- Store bids using `insertBid()`
- Update listings on ModifyListing, CancelListing, FinalizeListing events

### 4. Environment Variables

Add to `.env`:
```
POSTGRES_URL=your_postgres_connection_string
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001  # For frontend
```

### 5. Run Both Services

```bash
# Terminal 1: Start indexer
cd apps/backend
pnpm start

# Terminal 2: Start API server
cd apps/backend
pnpm api

# Terminal 3: Start frontend
cd apps/auctionhouse
pnpm dev
```

## API Endpoints

- `GET /api/listings` - Get all listings (with filters)
- `GET /api/listings/active` - Get active INDIVIDUAL_AUCTION listings
- `GET /api/listings/:id` - Get specific listing
- `GET /api/listings/:id/bids` - Get bid history for a listing
- `GET /health` - Health check

## Benefits

- **Faster**: Cached data vs direct blockchain queries
- **Efficient**: No need to check IDs 1-20 sequentially
- **Filtered**: Only active auctions returned
- **Scalable**: Pagination support ready
- **Real-time**: Polling can be replaced with WebSockets later

