# CryptoArt Studio App

A Farcaster Mini App for managing crypto art collections, auctions, and community engagement.

## Overview

The CryptoArt Studio App is a Next.js application that serves as a comprehensive toolkit for crypto artists and collectors. It provides:

- **Collection Management**: Track and manage NFT collections
- **Auction Creation**: Create and manage NFT auctions via auctionhouse contracts
- **LSSVM Pools**: Deploy liquidity pools for NFT trading
- **Community Tools**: Airdrops, member tracking, and channel analytics
- **Dual Mode**: Works as both a Farcaster Mini App and standalone web3 app

Built with Next.js 15, TypeScript, and React 19.

## Quick Links

- **[Developer Guide](./DEVELOPER_GUIDE.md)** - Architecture and development patterns
- **[Environment Variables](./ENV_VARS.md)** - Configuration guide
- **[Dual Mode Guide](./DUAL_MODE_GUIDE.md)** - Mini App vs Web3 mode
- **[Quick Reference](./QUICK_REFERENCE.md)** - Quick overview

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm
- A wallet (MetaMask, Coinbase Wallet, etc.)
- Neynar API key (for Farcaster features)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Configure your environment variables (see ENV_VARS.md)
```

### Running Locally

```bash
# Development server
npm run dev

# Development with tunneling (for mobile testing)
npm run dev:tunnel

# Development without tunneling
npm run dev:local
```

The app will be available at `http://localhost:3000`

## Environment Setup

Create a `.env.local` file in the project root with the following configuration:

```bash
# Neynar API Configuration
NEYNAR_API_KEY=your_neynar_api_key_here
NEYNAR_CLIENT_ID=your_neynar_client_id_here

# Next.js Configuration
NEXT_PUBLIC_URL=http://localhost:3000

# Tunneling Configuration for Farcaster Testing
# Set to 'true' to enable localtunnel for testing on mobile devices
USE_TUNNEL=false

# Optional: Database Configuration (if using database features)
POSTGRES_URL=postgresql://username:password@host:port/database
POSTGRES_PRISMA_URL=postgresql://username:password@host:port/database
POSTGRES_URL_NON_POOLING=postgresql://username:password@host:port/database

# Optional: Creator Tools APIs (if using creator tools features)
ALCHEMY_API_KEY=your_alchemy_api_key_here
CRYPTOART_HYPERSUB_CONTRACT=0x...
AIRDROP_WALLET_PRIVATE_KEY=0x...
```

### Testing with Farcaster

#### Desktop Testing

1. Run `npm run dev` to start the development server
2. Open the [Warpcast Mini App Developer Tools](https://warpcast.com/~/developers)
3. Enter your local URL: `http://localhost:3000`
4. Click "Preview" to test your mini app

#### Mobile Testing (Tunneling)

To test on mobile devices or in the Warcaster mobile app:

1. Set `USE_TUNNEL=true` in your `.env.local` file
2. Run `npm run dev` - this will automatically start a localtunnel
3. Follow the instructions displayed in the terminal:
   - Open the localtunnel URL in your browser
   - Enter your IP address in the password field
   - Click "Click to Submit"
4. Use the localtunnel URL in Warpcast Developer Tools or mobile app

**Important**: You must submit your IP address in the localtunnel password field before testing in Warpcast.

## Features

### Studio Tools
- **Collection Management**: Import and track NFT collections
- **Auction Creation**: Create timed auctions with reserve prices
- **LSSVM Pools**: Deploy liquidity pools with various bonding curves
- **NFT Minting**: Mint 1/1s, series, and editions

### Community Tools
- **Airdrops**: Batch token distribution to community members
- **Member Tracking**: Track Hypersub memberships and subscribers
- **Channel Analytics**: Analyze Farcaster channel activity
- **Notifications**: Send notifications to community members

### Developer Features
- **Dual Mode**: Works as Farcaster Mini App or standalone web3 app
- **Wallet Integration**: Supports MetaMask, Coinbase Wallet, Frame connector
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Redis-backed caching for performance

## Architecture

- **Frontend**: Next.js 15 App Router + React 19
- **Styling**: Tailwind CSS + shadcn/ui components
- **Blockchain**: Wagmi + Viem for Ethereum, Base network primary
- **Auth**: Farcaster authentication via Neynar SDK
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Upstash Redis

See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for detailed architecture information.

## Deployment

### Vercel Deployment

```bash
npm run deploy:vercel
```

For complete deployment instructions including environment variables and database setup, see the [main deployment guide](../../DEPLOYMENT.md#cryptoart-studio-app).

## Development Scripts

- `npm run dev` - Start development server (uses USE_TUNNEL from .env.local)
- `npm run dev:tunnel` - Start with tunneling enabled
- `npm run dev:local` - Start with tunneling disabled
- `npm run build` - Create production build
- `npm run cleanup` - Kill processes using the development port

## Contributing

See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for development patterns and contribution guidelines.

## License

See [LICENSE](./LICENSE) file for details.

## Resources

- [Farcaster Mini Apps Documentation](https://docs.farcaster.xyz/mini-apps)
- [Neynar API Documentation](https://docs.neynar.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Wagmi Documentation](https://wagmi.sh/)

