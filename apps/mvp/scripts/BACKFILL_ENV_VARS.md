# Environment Variables Required for Backfill Script

## Required Variables

### 1. Subgraph Access
- **`NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL`** (REQUIRED)
  - The GraphQL endpoint for the auctionhouse subgraph
  - Example: `https://gateway.thegraph.com/api/subgraphs/id/...`

### 2. Database Connection
- **`STORAGE_POSTGRES_URL`** or **`POSTGRES_URL`** (REQUIRED)
  - PostgreSQL connection string for database access
  - Used for checking cached thumbnails and hidden users
  - Example: `postgresql://user:password@host:port/database`

## Optional Variables

### 3. Subgraph Authentication (Optional)
- **`GRAPH_STUDIO_API_KEY`** (OPTIONAL)
  - API key for authenticated subgraph requests
  - Only needed if your subgraph requires authentication

### 4. RPC Endpoint (Optional)
- **`NEXT_PUBLIC_RPC_URL`** or **`RPC_URL`** or **`NEXT_PUBLIC_BASE_RPC_URL`** (OPTIONAL)
  - Base RPC endpoint for fetching NFT metadata
  - Defaults to `https://mainnet.base.org` if not set
  - Recommended: Use a reliable RPC provider (Alchemy, Infura, etc.)

### 5. Thumbnail Storage (Choose ONE)

#### Option A: Vercel Blob Storage
- **`BLOB_READ_WRITE_TOKEN`** (REQUIRED if using Vercel Blob)
- **`BLOB_READ_URL`** (OPTIONAL - for custom CDN URL)

#### Option B: S3-Compatible Storage (R2, S3, etc.)
- **`S3_BUCKET`** or **`R2_BUCKET`** (REQUIRED)
- **`S3_REGION`** or **`R2_REGION`** (OPTIONAL - defaults to 'auto')
- **`S3_ENDPOINT`** or **`R2_ENDPOINT`** (OPTIONAL - for custom endpoints like R2)
- **`S3_ACCESS_KEY_ID`** (REQUIRED)
- **`S3_SECRET_ACCESS_KEY`** (REQUIRED)

#### Option C: Local Filesystem (Development Only)
- No variables needed - automatically used in development mode

## Summary

**Minimum Required:**
1. `NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL`
2. `STORAGE_POSTGRES_URL` (or `POSTGRES_URL`)

**Recommended for Production:**
3. `NEXT_PUBLIC_RPC_URL` (or equivalent)
4. One of the thumbnail storage options above

**Optional:**
5. `GRAPH_STUDIO_API_KEY` (if subgraph requires auth)

## Example .env.local

```bash
# Required
NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL=https://gateway.thegraph.com/api/subgraphs/id/YOUR_SUBGRAPH_ID
STORAGE_POSTGRES_URL=postgresql://user:password@host:port/database

# Recommended
NEXT_PUBLIC_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Thumbnail Storage (choose one)
# Option 1: Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_xxx
BLOB_READ_URL=https://your-blob-url.vercel-storage.com

# Option 2: S3/R2
R2_BUCKET=your-bucket-name
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key

# Optional
GRAPH_STUDIO_API_KEY=your-graph-api-key
```




