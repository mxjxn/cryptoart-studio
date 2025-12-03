# Auctionhouse Ponder

Ponder indexer for the Auctionhouse marketplace contract on Base. This is a migration from the Graph Protocol subgraph.

## Setup

1. Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

2. Install dependencies:

```bash
pnpm install
```

3. Start the development server:

```bash
pnpm dev
```

This will:
1. Create the `ponder` schema in your database
2. Sync historical events from the startBlock
3. Start the GraphQL server at `http://localhost:42069`

## GraphQL API

Test queries at `http://localhost:42069/graphql`.

### Example Queries

```graphql
# Get active listings
query {
  listings(
    where: { status: "ACTIVE" }
    orderBy: "createdAt"
    orderDirection: "desc"
    first: 10
  ) {
    items {
      id
      listingId
      seller
      tokenAddress
      tokenId
      initialAmount
      status
    }
  }
}

# Get bids for a listing
query {
  bids(
    where: { listingId: "1" }
    orderBy: "timestamp"
    orderDirection: "desc"
  ) {
    items {
      id
      bidder
      amount
      timestamp
    }
  }
}
```

## Contract Details

- **Network:** Base (chainId: 8453)
- **Marketplace Contract:** `0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9`
- **Start Block:** 38886000

## Deployment

This project is configured for Vercel deployment. Set the environment variables in your Vercel project settings:

- `PONDER_RPC_URL_8453`: Base RPC URL (Alchemy, QuickNode, etc.)
- `DATABASE_URL`: Supabase Postgres connection string with `?schema=ponder`

## Entity Schema

- **Listing**: Marketplace listings (auctions, fixed price, offers only)
- **Purchase**: Purchase events for fixed price listings
- **Bid**: Bid events for auctions
- **Offer**: Offer events for offers-only listings
- **Escrow**: Escrow payment events
