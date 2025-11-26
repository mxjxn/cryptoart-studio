# MVP Auction Mini-App

A minimal Farcaster mini-app for creating and bidding on NFT auctions.

## Features

- **Homepage**: Browse all active auctions
- **Create Auction**: List your NFT for auction
- **Auction Detail**: View auction details and place bids
- **Profile**: View your created auctions, collected NFTs, and active bids

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

## Notes

- All data comes from the subgraph (no database needed)
- Cast embed images are generated for every page
- Uses Farcaster mini-app SDK for wallet integration

