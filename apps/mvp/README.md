# Cryptoart.social MVP release

A minimal Farcaster mini-app for creating and bidding on NFT auctions.

## Features

- **Homepage**: Browse all active auctions
- **Create Auction**: List your NFT for auction
- **Auction Detail**: View auction details and place bids
- **Profile**: View your created auctions, collected NFTs, and active bids
  - Cancelled auctions are automatically filtered out from profile history
- **Public Profiles**: View other users' auction history and collections

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file:
```
NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_MARKETPLACE_ADDRESS=0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL=https://api.studio.thegraph.com/query/...
```

3. Update `public/.well-known/farcaster.json` with your domain and sign it using the [Farcaster Manifest Tool](https://warpcast.com/~/developers/manifest)

4. Run the development server:
```bash
npm run dev
```

## Environment Variables

- `NEXT_PUBLIC_URL` - App URL (required for embeds)
- `NEXT_PUBLIC_MARKETPLACE_ADDRESS` - Marketplace contract address
- `NEXT_PUBLIC_CHAIN_ID` - Chain ID (default: 8453)
- `NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL` - Subgraph endpoint
- `NEYNAR_API_KEY` - Neynar API key (optional)
- `STORAGE_POSTGRES_URL` or `POSTGRES_URL` - PostgreSQL connection string (optional, for caching user info)

## Notes

- All data comes from the subgraph (primary data source)
- Database is optional but recommended for caching user info (artist names, Farcaster usernames)
  - If `STORAGE_POSTGRES_URL` or `POSTGRES_URL` is not set, the app will work without caching
  - Caching improves performance and reduces API calls to Neynar
- Cast embed images are generated for every page
- Uses Farcaster mini-app SDK for wallet integration

