# Creator Core & Auctionhouse Subgraph

This subgraph indexes events from Creator Core contracts (ERC721/ERC1155) and the Auctionhouse marketplace.

## Setup

### Prerequisites

- Node.js >= 18
- Graph CLI: `npm install -g @graphprotocol/graph-cli`

### Installation

```bash
npm install
```

## Configuration

1. Update `subgraph.yaml` with your contract addresses and start blocks
2. Generate ABIs from your contracts:

```bash
# For Creator Core contracts
forge build --out ./abis
# Copy ABI JSON files to packages/subgraph/abis/

# For Auctionhouse
cd ../auctionhouse-contracts
forge build --out ../subgraph/abis
```

## Development

### Code Generation

Generate TypeScript types from schema:

```bash
npm run codegen
```

### Build

Build the subgraph:

```bash
npm run build
```

### Local Development

Start a local Graph node:

```bash
# Using Docker
docker-compose up

# Or use The Graph's local node
graph node --ipfs http://localhost:5001 --http-port 8020 --ws-port 8030 --admin-port 8040
```

Create and deploy to local node:

```bash
npm run create-local
npm run deploy-local
```

## Deployment

### Graph Studio

1. Create a subgraph on [Graph Studio](https://thegraph.com/studio/)
2. Get your deployment key
3. Deploy:

```bash
graph auth --studio <DEPLOY_KEY>
npm run deploy
```

### Alchemy Integration

For Alchemy-hosted subgraphs:

```bash
npm run deploy:alchemy
```

## Schema

The subgraph tracks:

- **CreatorCore**: Contract deployments and metadata
- **Token**: Individual tokens (721 or 1155)
- **Extension**: Registered extensions
- **MintEvent**: Token minting events
- **TransferEvent**: Token transfers
- **RoyaltyUpdate**: Royalty configuration changes
- **Listing**: Marketplace listings
- **Purchase**: Purchase events
- **Bid**: Auction bids

## Querying

Example queries:

```graphql
# Get all tokens for a contract
{
  tokens(where: { creatorCore: "0x..." }) {
    id
    tokenId
    tokenURI
    currentOwner
  }
}

# Get active listings
{
  listings(where: { status: "ACTIVE" }) {
    id
    listingId
    seller
    initialAmount
    totalSold
    totalAvailable
  }
}

# Get mint events
{
  mintEvents(
    where: { creatorCore: "0x..." }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    tokenId
    to
    timestamp
  }
}
```

## Troubleshooting

### "Failed to fetch subgraph"

- Check that the subgraph is synced
- Verify contract addresses in `subgraph.yaml`
- Check start blocks are correct

### "Entity not found"

- Ensure events are being indexed
- Check event handlers are correct
- Verify ABI files match contract interfaces

### Sync Issues

- Increase `startBlock` if contract was deployed earlier
- Check RPC endpoint is working
- Verify network configuration

