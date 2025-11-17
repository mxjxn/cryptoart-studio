# Backend API & Indexer

This backend provides two main services for the auctionhouse mini app:

1. **Blockchain Indexer** (`index.js`) - Monitors Base network for marketplace events
2. **REST API Server** (`api.js`) - Provides HTTP endpoints for querying auction data

## Architecture

```text
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Base      │──────│   Indexer    │──────│  Database   │
│  Network    │      │  (index.js)  │      │  (Postgres)  │
└─────────────┘      └──────────────┘      └─────────────┘
                                                  │
                                                  │
                                          ┌───────▼───────┐
                                          │  API Server   │
                                          │   (api.js)    │
                                          └───────┬───────┘
                                                  │
                                          ┌───────▼───────┐
                                          │   Frontend    │
                                          │  (auctionhouse)│
                                          └───────────────┘
```

## Components

### 1. Indexer (`index.js`)

Monitors the Base network for marketplace contract events:

- **Contract**: `0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9`
- **Network**: Base Mainnet
- **Events Tracked**:
  - `CreateListing` - New auction listings
  - `CreateListingTokenDetails` - Token information for listings
  - `CreateListingFees` - Fee configuration
  - `BidEvent` - Auction bids
  - `ModifyListing` - Listing updates
  - `CancelListing` - Cancelled listings
  - `FinalizeListing` - Completed auctions

**Note**: Currently configured to scan historical blocks. Real-time monitoring can be added.

### 2. API Server (`api.js`)

Express.js REST API providing endpoints for auction data:

- Runs on port `3001` by default
- CORS enabled for frontend access
- Currently returns placeholder responses (database integration pending)

### 3. Database Schema (`packages/db/src/schema.ts`)

PostgreSQL tables defined:

- `auction_listings` - All auction listings with metadata
- `auction_bids` - Complete bid history

**Storage Utilities** (`storage.js`):

- `upsertListing()` - Store/update listings
- `insertBid()` - Record bids
- `updateListingStatus()` - Update listing state

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Alchemy API key (for Base network access)

### Installation

```bash
cd apps/backend
pnpm install
```

### Environment Variables

Create a `.env` file:

```bash
# Database connection
POSTGRES_URL=postgresql://user:password@localhost:5432/dbname

# Alchemy API key (for Base network)
ALCHEMY_API_KEY=your_alchemy_api_key

# API server port
PORT=3001

# Marketplace contract address (Base mainnet)
MARKETPLACE_ADDRESS=0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9
```

### Database Setup

Run migrations to create tables:

```bash
cd packages/db
pnpm db:generate  # Generate migration files from schema
pnpm db:push      # Push schema to database
```

### Running Services

**Terminal 1 - Indexer:**

```bash
cd apps/backend
pnpm start        # Run indexer once
pnpm dev          # Run with auto-reload (development)
```

**Terminal 2 - API Server:**

```bash
cd apps/backend
pnpm api          # Start API server on port 3001
```

**Terminal 3 - Frontend:**

```bash
cd apps/auctionhouse
pnpm dev          # Start Next.js dev server
```

## API Endpoints

### Listings

- `GET /api/listings` - Get all listings
  - Query params: `type`, `status`, `limit`, `offset`
  - Returns: `{ listings: [], total: 0 }`

- `GET /api/listings/active` - Get active INDIVIDUAL_AUCTION listings
  - Returns: `{ listings: [], total: 0 }`

- `GET /api/listings/:id` - Get specific listing by ID
  - Returns: Listing object or 404

- `GET /api/listings/:id/bids` - Get bid history for a listing
  - Returns: `{ bids: [], total: 0 }`

### Health

- `GET /health` - Health check endpoint
  - Returns: `{ status: 'ok', timestamp: '...' }`

## Current Status

✅ **Completed:**

- Database schema defined (`packages/db/src/schema.ts`)
- API server structure (`api.js`)
- Indexer event detection (`index.js`)
- Storage utilities (`storage.js`)
- Event signature mapping for library events

⚠️ **Pending:**

- Database connection in API server
- Event decoding and storage in indexer
- Real-time event monitoring (currently historical scan only)
- Frontend integration with API endpoints

## Next Steps

1. **Connect Database to API**
   - Import `@repo/db` package in `api.js`
   - Implement database queries in endpoint handlers

2. **Implement Event Processing**
   - Update `index.js` to decode event data properly
   - Store listings using `storage.js` utilities
   - Process `BidEvent`, `ModifyListing`, `CancelListing`, `FinalizeListing`

3. **Add Real-time Monitoring**
   - Poll for new blocks continuously
   - Store last processed block number
   - Handle reorgs and missed blocks

4. **Error Handling & Logging**
   - Add structured logging
   - Implement retry logic for RPC calls
   - Handle database connection errors gracefully

## Configuration

Marketplace contract configuration is in `config.js`:

- Contract address
- Event signatures
- RPC endpoints
- Batch settings

## Development

The indexer uses event signatures (not full ABI) to detect library events emitted by the marketplace contract. This allows monitoring events that aren't in the main contract ABI.

For development, use `pnpm dev` which runs with `--watch` for auto-reload.
