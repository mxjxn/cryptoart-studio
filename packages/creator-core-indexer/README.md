# Creator Core Indexer

Indexes all Creator Core contracts (ERC721, ERC1155, ERC6551) deployed through the contract suite.

## Features

- **Contract Detection**: Automatically detects and indexes new Creator Core contracts
- **Event Indexing**: Tracks Transfer events to detect mints and transfers
- **Extension Tracking**: Monitors extension registrations and unregistrations
- **Metadata Caching**: Fetches and caches NFT metadata from tokenURIs
- **Incremental Indexing**: Processes blocks incrementally, handling reorgs

## Environment Variables

- `RPC_URL` (required): Base network RPC endpoint
- `CHAIN_ID` (optional): Chain ID (default: 8453 for Base)
- `START_BLOCK` (optional): Block number to start indexing from
- `BATCH_SIZE` (optional): Number of blocks to process per batch (default: 100)
- `POLL_INTERVAL` (optional): Milliseconds between polling cycles (default: 12000)
- `ERC721_IMPLEMENTATION_ADDRESSES` (optional): Comma-separated list of ERC721 implementation addresses
- `ERC1155_IMPLEMENTATION_ADDRESSES` (optional): Comma-separated list of ERC1155 implementation addresses
- `ERC6551_IMPLEMENTATION_ADDRESSES` (optional): Comma-separated list of ERC6551 implementation addresses

## Usage

### As a Service

```bash
npm run index
```

### Programmatic

```typescript
import { CreatorCoreIndexer } from '@repo/creator-core-indexer';

const indexer = new CreatorCoreIndexer();
await indexer.initialize();
await indexer.start();
```

## Architecture

The indexer:

1. **Monitors Blocks**: Polls for new blocks and processes events
2. **Detects Contracts**: Checks if contracts are Creator Core contracts
3. **Indexes Events**: Processes Transfer, ExtensionRegistered, ExtensionUnregistered events
4. **Caches Metadata**: Fetches NFT metadata and stores in database
5. **Handles Reorgs**: Can be configured to handle blockchain reorganizations

## Database Tables

The indexer writes to:
- `creator_core_contracts`: Contract deployments
- `creator_core_tokens`: Individual NFTs
- `creator_core_transfers`: All transfer events
- `creator_core_extensions`: Extension registrations
- `nft_metadata_cache`: Cached NFT metadata

