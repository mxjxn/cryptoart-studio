# Open Source Deployment Guide

This guide helps you deploy your own instance of the Cryptoart platform from the open source codebase.

## Overview

The Cryptoart monorepo is open source, but requires proper configuration of environment variables to function. This guide walks you through setting up your own deployment.

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.1.4
- PostgreSQL database (Supabase recommended)
- Vercel account (or your preferred hosting platform)
- Access to Base Mainnet (or your target network)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/cryptoart-monorepo
cd cryptoart-monorepo
pnpm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in `apps/mvp/` (or use your platform's environment variable configuration):

```bash
# Copy the example (if available) or see docs/ENV_VARS_MANAGEMENT.md
cp apps/mvp/.env.example apps/mvp/.env.local
```

**Required Variables:**

```bash
# Database
STORAGE_POSTGRES_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

# Application
NEXT_PUBLIC_URL=https://your-domain.com

# Admin Configuration (REQUIRED)
ADMIN_WALLET_ADDRESS=0xYourAdminWalletAddress
ADMIN_FARCASTER_USERNAME=your-farcaster-username
ADMIN_FID=your-farcaster-fid

# Blockchain
RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
CHAIN_ID=8453

# Optional but Recommended
NEYNAR_API_KEY=your_neynar_api_key
ALCHEMY_API_KEY=your_alchemy_api_key
GRAPH_STUDIO_API_KEY=your_graph_studio_api_key
CRON_SECRET=your-random-secret-string
```

### 3. Database Setup

1. Create a PostgreSQL database (Supabase recommended for Vercel)
2. Run migrations:

```bash
pnpm db:migrate-all
```

### 4. Deploy

**Vercel:**
```bash
cd apps/mvp
vercel deploy
```

**Other Platforms:**
Follow your platform's Next.js deployment guide.

## Important Security Notes

### Admin Configuration

The admin wallet address controls:
- Featured listings management
- User hiding/visibility
- Error log resolution
- Analytics access
- Notification settings

**⚠️ Critical:** 
- Use a dedicated wallet for admin operations
- Never share the admin wallet private key
- Store admin configuration in environment variables only
- The admin address in the codebase is a placeholder - you must set your own

### Environment Variables

**Never commit these to Git:**
- `ADMIN_WALLET_ADDRESS`
- `ADMIN_FARCASTER_USERNAME`
- `ADMIN_FID`
- `POSTGRES_URL` / `STORAGE_POSTGRES_URL`
- Any API keys
- `CRON_SECRET`
- `ADMIN_SECRET`

All `.env*` files should be in `.gitignore` (already configured).

## Customization

### Changing Admin Identity

To set your own admin:

1. Set `ADMIN_WALLET_ADDRESS` to your wallet address
2. Set `ADMIN_FARCASTER_USERNAME` to your Farcaster username
3. Set `ADMIN_FID` to your Farcaster FID

The admin check requires:
- Wallet address match (from `ADMIN_WALLET_ADDRESS`)
- Optional: Farcaster username match (from `ADMIN_FARCASTER_USERNAME`)

### Network Configuration

To deploy on a different network:

1. Update `CHAIN_ID` in environment variables
2. Update contract addresses in `apps/mvp/src/lib/constants.ts`
3. Update RPC URL to match your network
4. Deploy contracts to your network (see contract packages)

## Database Schema

The database schema is public and documented in `packages/db/src/schema.ts`. This is safe to expose as it only shows structure, not data.

Key tables:
- `user_cache` - Cached user information
- `notifications` - In-app notifications
- `featured_listings` - Featured listings
- `hidden_users` - Users hidden from feeds
- `analytics_snapshots` - Analytics data

## API Routes

All API routes are public in the codebase. Key routes:

- `/api/admin/*` - Admin routes (require admin wallet)
- `/api/auctions/*` - Auction data
- `/api/listings/*` - Listing data
- `/api/user/*` - User profiles
- `/api/cron/*` - Cron jobs (require `CRON_SECRET`)

## Troubleshooting

### Admin Access Not Working

1. Verify `ADMIN_WALLET_ADDRESS` is set correctly
2. Ensure you're connecting with the admin wallet
3. Check that Farcaster username matches (if required)
4. Check server logs for admin verification errors

### Database Connection Issues

1. Use pooled connection string for serverless (Supabase port 6543)
2. Verify connection string format
3. Check IP allowlisting (if using direct connection)
4. See [DATABASE_CONNECTION_FIX.md](./DATABASE_CONNECTION_FIX.md)

### Build Failures

1. Ensure all required environment variables are set
2. Check `turbo.json` for required env vars in build task
3. Verify Node.js version (>= 18.0.0)

## Getting Help

- **Documentation**: See `docs/` directory
- **Issues**: Open a GitHub issue (for non-security issues)
- **Security**: See [SECURITY.md](./SECURITY.md)

## License

See individual package licenses in their respective directories.

