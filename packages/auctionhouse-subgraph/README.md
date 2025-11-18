# Auctionhouse Subgraph

The Graph subgraph for indexing Creator Core and Auctionhouse events on Base Mainnet.

## Overview

This subgraph indexes:
- **Auctionhouse Marketplace Events**: Listings, purchases, bids, offers from the marketplace contract
- **Creator Core Events**: Extension registrations, royalties, token mints from Creator Core contracts
- **Library Events**: Events emitted from `MarketplaceLib.sol` and `SettlementLib.sol` libraries

## Key Features

### Library Event Support

The subgraph includes support for library events that are emitted from the marketplace contract but not in the main contract ABI:

- `MarketplaceLib.sol` events: `CreateListing`, `CreateListingTokenDetails`, `CreateListingFees`, `PurchaseEvent`, `BidEvent`, `OfferEvent`, `RescindOfferEvent`, `AcceptOfferEvent`, `ModifyListing`, `CancelListing`, `FinalizeListing`
- `SettlementLib.sol` events: `Escrow`

These events are indexed by including the library ABIs in `subgraph.yaml` and listening to events emitted from the marketplace contract address.

### Event Linking

The subgraph automatically links related events:
- `CreateListing` + `CreateListingTokenDetails` + `CreateListingFees` = Complete listing entity
- Purchase, bid, and offer events are linked to their parent listings

## Setup

### Prerequisites

- Node.js 18+
- The Graph CLI: `npm install -g @graphprotocol/graph-cli`
- Access to The Graph Studio

### Installation

```bash
# Install dependencies
npm install

# Generate TypeScript types from schema
npm run codegen

# Build the subgraph
npm run build
```

## Deployment

### Deploy to The Graph Studio

1. Create a subgraph in [The Graph Studio](https://thegraph.com/studio/)
2. Get your deployment key
3. Deploy:

```bash
# Set your deployment key
export GRAPH_DEPLOY_KEY=your-deployment-key

# Deploy
npm run deploy
```

Or use the full command:

```bash
graph deploy --node https://api.studio.thegraph.com/deploy/ --ipfs https://api.studio.thegraph.com/ipfs/ your-subgraph-name
```

### Local Development

```bash
# Start local Graph node (requires Docker)
docker-compose up

# Create local subgraph
npm run create-local

# Deploy to local node
npm run deploy-local
```

## Configuration

### Contract Addresses

- **Marketplace**: `0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9` (Base Mainnet)
- **Start Block**: `30437036` (First block with marketplace activity)

### Network

- **Network**: Base Mainnet (Chain ID: 8453)
- **RPC**: Configure in The Graph Studio dashboard

## Schema

The subgraph schema includes:

- **Listing**: Complete listing with all details
- **Purchase**: Purchase events
- **Bid**: Bid events
- **Offer**: Offer events
- **Escrow**: Escrow events
- **Collection**: Creator Core collections
- **Extension**: Registered extensions
- **Royalty**: Royalty configurations
- **Token**: NFT token details

See `schema.graphql` for full schema definition.

## Querying

Once deployed, query the subgraph using GraphQL:

```graphql
{
  listings(where: { status: "ACTIVE" }, first: 10) {
    id
    listingId
    seller
    tokenAddress
    tokenId
    initialAmount
    totalAvailable
    totalSold
    purchases {
      buyer
      amount
    }
    bids {
      bidder
      amount
    }
  }
}
```

## ABIs

The subgraph requires ABIs for:

- `MarketplaceCore.json` - Main marketplace contract ABI
- `MarketplaceLib.json` - Marketplace library ABI (for library events)
- `SettlementLib.json` - Settlement library ABI (for Escrow events)
- `CreatorCore.json` - Creator Core interface ABI
- `ERC721Creator.json` - ERC721 Creator contract ABI
- `ERC1155Creator.json` - ERC1155 Creator contract ABI

These should be placed in the `abis/` directory. You can extract them from the contract repositories or use tools like `abi-extractor`.

## Troubleshooting

### Library Events Not Indexing

If library events aren't being indexed:

1. Verify the library ABIs are in `abis/` directory
2. Check that `subgraph.yaml` includes the library ABIs in the `abis` section
3. Ensure event handlers are configured for library events
4. Verify the marketplace contract address is correct

### Missing Events

If events are missing:

1. Check the start block in `subgraph.yaml`
2. Verify the contract address is correct
3. Check The Graph Studio logs for indexing errors
4. Ensure event signatures match the ABI

## Development

### Adding New Events

1. Add event handler to `subgraph.yaml`
2. Add entity to `schema.graphql` if needed
3. Implement handler in `src/auctionhouse.ts` or `src/creator-core.ts`
4. Run `npm run codegen` to generate types
5. Test locally before deploying

## License

MIT

