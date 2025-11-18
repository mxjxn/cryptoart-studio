# Environment Variables

## Required

- `POSTGRES_URL`: Shared Postgres connection string
  - Format: `postgres://user:password@host:port/database`
  - Used by: All database operations

- `RPC_URL`: Base network RPC endpoint
  - Example: `https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
  - Used by: Blockchain event indexing

## Optional

- `CHAIN_ID`: Chain ID (default: 8453 for Base)
  - Used by: Contract detection and indexing

- `START_BLOCK`: Block number to start indexing from
  - If not set, indexer will start from the highest block in database
  - Used by: Initial indexing position

- `BATCH_SIZE`: Number of blocks to process per batch (default: 100)
  - Higher values = faster indexing but more memory usage
  - Used by: Block processing loop

- `POLL_INTERVAL`: Milliseconds between polling cycles (default: 12000)
  - Lower values = more frequent updates but more RPC calls
  - Used by: Polling loop

- `ERC721_IMPLEMENTATION_ADDRESSES`: Comma-separated list of ERC721 implementation addresses
  - Example: `0x123...,0x456...`
  - Used by: Contract detection for upgradeable contracts

- `ERC1155_IMPLEMENTATION_ADDRESSES`: Comma-separated list of ERC1155 implementation addresses
  - Example: `0x123...,0x456...`
  - Used by: Contract detection for upgradeable contracts

- `ERC6551_IMPLEMENTATION_ADDRESSES`: Comma-separated list of ERC6551 implementation addresses
  - Example: `0x123...,0x456...`
  - Used by: Contract detection for ERC6551 contracts

## Shared Database Variables

These are used by `@repo/shared-db-config`:

- `REDIS_URL`: Standard Redis connection string (if not using Upstash)
- `KV_REST_API_URL`: Upstash Redis REST API URL
- `KV_REST_API_TOKEN`: Upstash Redis REST API token

