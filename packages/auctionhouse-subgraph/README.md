# Auctionhouse Subgraph

The Graph subgraph for indexing Creator Core and Auctionhouse events on Base and Ethereum mainnet (one Studio deployment per chain).

## Further reading

- **[Multi-chain indexing research](docs/RESEARCH_MULTI_CHAIN_INDEXING.md)** — The Graph’s “one deployment = one network” rule, `networks.json`, Substreams vs subgraphs, and how this repo’s library-event pattern maps to Ethereum mainnet.

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
2. Copy the **deploy key** and **subgraph slug** from that subgraph’s details page (slug must match exactly).
3. Authenticate and deploy from `packages/auctionhouse-subgraph`:

With **Graph CLI 0.60+**, the first argument to `graph auth` is the **node URL** unless you pass `--studio` (or `--product subgraph-studio`). The old one-liner `graph auth <DEPLOY_KEY>` stores the key under the wrong key in `~/.graph-cli.json`, so deploys to Studio send **no** Bearer token and often fail with **Subgraph not found**.

```bash
cd packages/auctionhouse-subgraph
npx graph auth --studio YOUR_DEPLOY_KEY
npm run codegen
npm run build:mainnet   # or build:base
npx graph deploy --studio --network mainnet --network-file networks.json YOUR_SUBGRAPH_SLUG
```

`npm run deploy:base` / `npm run deploy:mainnet` add `--studio` and the correct IPFS host. Scripts use Studio slugs **`cryptoart-auctionhouse`** (Base) and **`cryptoart-auctionhouse-ethereum`** (mainnet); change them in `package.json` if your dashboard slugs differ.

If you pass endpoints explicitly, **do not** use `https://api.studio.thegraph.com/ipfs/` — it returns **404**; use The Graph’s IPFS gateway:

```bash
npx graph deploy \
  --studio \
  --node https://api.studio.thegraph.com/deploy/ \
  --ipfs https://ipfs.network.thegraph.com \
  --network mainnet \
  --network-file networks.json \
  YOUR_SUBGRAPH_SLUG
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

### Network parameterization (Base + Ethereum mainnet)

This subgraph is written once and deployed per network.

- The marketplace proxy address and `startBlock` are stored in [`networks.json`](./networks.json).
- Build/deploy for each network uses `graph build --network <name> --network-file networks.json` (see `package.json` scripts).

Expected config keys in `networks.json`:

- `base`: marketplace **proxy** `0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9`, `startBlock` `38886000`
- `mainnet`: marketplace **proxy** `0x3CEE515879FFe4620a1F8aC9bf09B97e858815Ef`, `startBlock` `25068447` (tighten to the proxy creation block after a new deploy — see [`../auctionhouse-contracts/DEPLOYED_ADDRESSES.md`](../auctionhouse-contracts/DEPLOYED_ADDRESSES.md))

Always index the **ERC1967 / UUPS proxy**, not the implementation. **Never** reuse the Base proxy address as an approval target on mainnet (or the reverse): check **chain ID** in the wallet.

### GraphQL endpoints (used by the MVP)

After you deploy to The Graph Network / Studio, copy the **Query URL** from the Subgraph page:

- Base (8453): set `NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL` to the Base subgraph Query URL
- Ethereum mainnet (1): set `NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL_MAINNET` to the Ethereum mainnet subgraph Query URL

The app reads these env vars on the server and merges results across chains.

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

