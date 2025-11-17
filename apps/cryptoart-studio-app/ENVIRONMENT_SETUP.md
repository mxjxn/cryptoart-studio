# Environment Variables & Database Setup Guide

This document explains all environment variables required for the CryptoArt Studio App and the two database systems in use.

## Overview: Two Database Systems

The app uses **two separate database systems** for different purposes:

### 1. PostgreSQL (`@repo/db`) - Primary Database
**Purpose**: Persistent data storage and caching
- Hypersub subscription/subscriber caching
- NFT collections tracking
- Airdrop lists and history
- Auction listings and bids
- Clanker tokens

**Package**: `packages/db` (uses Drizzle ORM)

### 2. Redis/KV (`@upstash/redis`) - Session & Notifications
**Purpose**: Fast key-value storage for temporary data
- Farcaster mini-app notification tokens
- Session data
- Temporary cache

**Package**: `src/lib/kv.ts` (uses Upstash Redis)

---

## Complete Environment Variables List

### 🔴 Required (App won't work without these)

```bash
# Neynar API Configuration (REQUIRED)
NEYNAR_API_KEY=your_neynar_api_key_here
NEYNAR_CLIENT_ID=your_neynar_client_id_here

# App URL (REQUIRED)
NEXT_PUBLIC_URL=http://localhost:3000
# For production: https://your-domain.com
# For tunneling: https://your-tunnel-url.ngrok.io
```

### 🟡 PostgreSQL (Required for Studio Features)

```bash
# PostgreSQL Database Connection
# Used for: NFT collections (Creator Core), auction listings (Auctionhouse)
POSTGRES_URL=postgresql://username:password@host:port/database
POSTGRES_PRISMA_URL=postgresql://username:password@host:port/database
POSTGRES_URL_NON_POOLING=postgresql://username:password@host:port/database

# Note: All three URLs are typically the same, but some hosting providers
# (like Vercel) require separate pooled and non-pooled connections
```

**PostgreSQL Providers:**
- **Vercel Postgres**: Automatically provides all three URLs
- **Supabase**: Use connection string from project settings
- **Railway**: Use connection string from service
- **Neon**: Use connection string from dashboard

### 🟡 Redis/KV (Optional - Falls back to in-memory)

```bash
# Upstash Redis Configuration
# Used for: Notification tokens, session data
# If not set, app uses in-memory storage (data lost on restart)
KV_REST_API_URL=https://your-redis-instance.upstash.io
KV_REST_API_TOKEN=your_upstash_redis_token

# Get these from: https://console.upstash.com/
```

### 🟡 Blockchain & NFT Features (Required for Studio)

```bash
# Alchemy API (Required for NFT queries)
ALCHEMY_API_KEY=your_alchemy_api_key
# Get from: https://dashboard.alchemy.com/

# CryptoArt Hypersub Contract (Required for membership checks)
CRYPTOART_HYPERSUB_CONTRACT=0x...
# Your deployed Hypersub contract address

# Airdrop Wallet (Not currently used - will be needed later for subscriptions section)
# AIRDROP_WALLET_PRIVATE_KEY=0x...
# Private key of wallet that will execute airdrops
# ⚠️ SECURITY: Never commit this to git!
```

### 🟢 Optional (Development & Advanced Features)

```bash
# Tunneling for Mobile Testing
USE_TUNNEL=false
# Set to true to enable localtunnel for mobile Farcaster testing

# Development Bypass
DEV_BYPASS_MEMBERSHIP=true
# Bypass membership validation in development (DANGEROUS in production!)

# Cron Job Security (Optional but recommended)
CRON_SECRET=your-secure-random-string
# Used to secure cron job endpoints for cache cleanup

# IPFS/Pinata (For NFT metadata uploads)
PINATA_JWT=your_pinata_jwt_token
# Get from: https://app.pinata.cloud/
# Used for uploading NFT metadata and images to IPFS

# Signer Configuration (Advanced - for Farcaster signers)
SEED_PHRASE=your_seed_phrase_here
SPONSOR_SIGNER=false
# Only needed if you're running your own Farcaster signer
```

---

## Database Setup Instructions

### PostgreSQL Setup

1. **Create a PostgreSQL Database**
   - **Vercel**: Go to your project → Storage → Create Database → Postgres
   - **Supabase**: Create new project → Copy connection string
   - **Railway**: Create new service → PostgreSQL → Copy connection string
   - **Neon**: Create new project → Copy connection string

2. **Run Database Migrations**
   ```bash
   cd packages/db
   pnpm install
   pnpm run db:push
   ```
   This creates all necessary tables:
   - `nft_collections` - Deployed NFT contracts (Creator Core - Studio App)
   - `collection_mints` - NFT minting history (Creator Core - Studio App)
   - `auction_listings` - Marketplace auction listings (Auctionhouse - Backend Indexer)
   - `auction_bids` - Auction bid history (Auctionhouse - Backend Indexer)
   
   **Note**: Subscription cache, subscriber cache, clanker tokens, and airdrop tables are commented out and will be added when implementing those features.

3. **Verify Tables Created**
   ```bash
   pnpm run db:studio
   # Opens Drizzle Studio at http://localhost:4983
   ```

### Redis/KV Setup (Optional)

1. **Create Upstash Redis Instance**
   - Go to https://console.upstash.com/
   - Create new database
   - Choose region closest to your app
   - Copy `UPSTASH_REDIS_REST_URL` → use as `KV_REST_API_URL`
   - Copy `UPSTASH_REDIS_REST_TOKEN` → use as `KV_REST_API_TOKEN`

2. **Test Connection**
   The app will automatically use Redis if env vars are set, otherwise falls back to in-memory storage.

---

## What Each Database Stores

### PostgreSQL Tables

**Active Tables (Focus on Basics):**

| Table | Purpose | Used By |
|-------|---------|---------|
| `nft_collections` | Track deployed NFT contracts (Creator Core) | Studio App |
| `collection_mints` | Track NFT mints (Creator Core) | Studio App |
| `auction_listings` | Track marketplace listings (Auctionhouse) | Backend Indexer |
| `auction_bids` | Track auction bids (Auctionhouse) | Backend Indexer |

**Commented Out (Future Use):**
- `subscriptions_cache` - Will be used when implementing subscription features
- `subscribers_cache` - Will be used when implementing subscription features
- `clanker_tokens` - Not implemented yet
- Airdrop tables (`airdrop_lists`, `list_recipients`, `airdrop_history`) - Will be used in subscriptions section

### Redis/KV Keys

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `{APP_NAME}:user:{fid}` | Farcaster notification tokens | Session-based |

---

## Environment Variable Priority

1. **Local Development**: `.env.local` (gitignored)
2. **Vercel**: Environment variables in dashboard
3. **Fallbacks**: In-memory storage for KV, direct API calls for cache

---

## Quick Setup Checklist

### Minimum Setup (App Works, Limited Features)
- [ ] `NEYNAR_API_KEY`
- [ ] `NEYNAR_CLIENT_ID`
- [ ] `NEXT_PUBLIC_URL`

### Full Studio Features
- [ ] All minimum variables
- [ ] `POSTGRES_URL` (and related URLs)
- [ ] `ALCHEMY_API_KEY`
- [ ] `CRYPTOART_HYPERSUB_CONTRACT`
- [ ] Run `pnpm run db:push` in `packages/db`

### Production Ready
- [ ] All studio features
- [ ] `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- [ ] `CRON_SECRET`
- [ ] `PINATA_JWT` (for IPFS uploads)
- [ ] `AIRDROP_WALLET_PRIVATE_KEY` (not currently used - will be needed later)

---

## Troubleshooting

### "POSTGRES_URL environment variable is required"
- Set `POSTGRES_URL` in `.env.local` or Vercel dashboard
- Ensure connection string is correct format: `postgresql://user:pass@host:port/db`

### "ECONNREFUSED" Cache Errors
- This is **normal** if PostgreSQL isn't configured
- App falls back to direct Neynar API calls
- To fix: Set up PostgreSQL and run migrations

### "ALCHEMY_API_KEY not configured"
- Required for NFT queries in studio
- Get free API key from https://dashboard.alchemy.com/
- Add to `.env.local`

### KV Cache Not Working
- Check `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set
- App falls back to in-memory storage if not configured
- In-memory storage is fine for development

---

## Security Notes

⚠️ **Never commit these to git:**
- `AIRDROP_WALLET_PRIVATE_KEY`
- `SEED_PHRASE`
- `CRON_SECRET`
- Database passwords
- API keys

✅ **Safe to commit:**
- `NEXT_PUBLIC_URL` (public anyway)
- `USE_TUNNEL` (just a flag)

---

## Related Documentation

- **Caching Strategy**: See `CACHING.md`
- **Developer Guide**: See `DEVELOPER_GUIDE.md`
- **Database Schema**: See `packages/db/src/schema.ts`
- **Cache Implementation**: See `packages/cache/src/hypersub-cache.ts`

