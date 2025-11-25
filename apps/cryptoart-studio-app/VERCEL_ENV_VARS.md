# Vercel Environment Variables

Complete list of environment variables required for deploying cryptoart-studio-app to Vercel.

## Required Variables

### `POSTGRES_URL`
- **Description**: Supabase PostgreSQL connection string (pooled)
- **Format**: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`
- **Required for**: All database operations
- **Get from**: Supabase Dashboard → Settings → Database → Connection Pooling
- **Important**: Use the **pooled connection string** (port 6543) for Vercel
- **Example**:
  ```
  postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
  ```

### `NEXT_PUBLIC_URL`
- **Description**: Public URL of your Vercel deployment
- **Format**: `https://your-app.vercel.app` or custom domain
- **Required for**: Client-side URL resolution, API routes, OAuth callbacks
- **Get from**: Vercel Dashboard → Project → Domains
- **Example**: `https://cryptoart-studio.vercel.app`

## Highly Recommended

### `NEYNAR_API_KEY`
- **Description**: Neynar API key for Farcaster integration
- **Required for**: 
  - User lookups
  - Channel data
  - Subscriptions
  - Notifications
- **Get from**: [Neynar Dashboard](https://neynar.com)
- **Note**: App will work without this, but Farcaster features will be disabled

### `NEYNAR_CLIENT_ID`
- **Description**: Neynar client ID
- **Required for**: Webhook configuration
- **Get from**: [Neynar Dashboard](https://neynar.com)
- **Note**: Only needed if using Neynar webhooks

## Redis/Caching (Already Configured with Upstash)

### `KV_REST_API_URL`
- **Description**: Upstash Redis REST API URL
- **Format**: `https://[endpoint].upstash.io`
- **Required for**: Caching features (optional but recommended)
- **Get from**: Upstash Dashboard
- **Note**: Already configured if using Upstash

### `KV_REST_API_TOKEN`
- **Description**: Upstash Redis REST API token
- **Required for**: Caching features (optional but recommended)
- **Get from**: Upstash Dashboard
- **Note**: Already configured if using Upstash

### Alternative: `REDIS_URL`
- **Description**: Standard Redis connection string (if not using Upstash)
- **Format**: `redis://user:password@host:port`
- **Note**: Use either Upstash (`KV_REST_API_URL`/`KV_REST_API_TOKEN`) OR standard Redis (`REDIS_URL`), not both

## Optional Features

### `CRYPTOART_HYPERSUB_CONTRACT`
- **Description**: Contract address for CryptoArt Hypersub membership validation
- **Format**: Ethereum address (e.g., `0x1234...`)
- **Required for**: Membership validation features
- **Note**: Only needed if using membership validation

### `DEV_BYPASS_MEMBERSHIP`
- **Description**: Bypass membership validation in development/testing
- **Values**: `true` or `false` (as string)
- **Example**: `DEV_BYPASS_MEMBERSHIP=true`
- **Note**: Set to `true` only in development/preview environments

### `ALCHEMY_API_KEY`
- **Description**: Alchemy API key for blockchain data
- **Required for**: NFT/blockchain queries
- **Get from**: [Alchemy Dashboard](https://www.alchemy.com/)
- **Note**: Only needed if using blockchain queries

### `AIRDROP_WALLET_PRIVATE_KEY`
- **Description**: Private key for airdrop wallet
- **Required for**: Airdrop functionality
- **Security**: ⚠️ Keep this secure, never commit to Git
- **Note**: Only needed if using airdrop features

### `CRON_SECRET`
- **Description**: Secret for authenticating cron job requests
- **Required for**: Scheduled sync jobs (subscriptions, subscribers)
- **Generate**: Use a random secure string (e.g., `openssl rand -hex 32`)
- **Note**: Prevents unauthorized access to cron endpoints
- **Example**: `CRON_SECRET=abc123def456...`

## Setting Environment Variables in Vercel

### Method 1: Via Vercel Dashboard (Recommended)

1. Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - **Key**: Variable name (e.g., `POSTGRES_URL`)
   - **Value**: Variable value
   - **Environment**: Select which environments to apply to:
     - ✅ **Production**
     - ✅ **Preview** (for pull requests)
     - ✅ **Development** (for `vercel dev`)
4. Click **Save**
5. **Redeploy** your project for changes to take effect

### Method 2: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link your project
vercel link

# Add environment variable
vercel env add POSTGRES_URL production
# Paste the value when prompted

# Pull environment variables locally (for development)
vercel env pull .env.local
```

## Environment-Specific Variables

You can set different values for different environments:

- **Production**: Live deployment at your production domain
- **Preview**: Automatic deployments for pull requests
- **Development**: Local development with `vercel dev`

### Recommended Setup

```bash
# Production - Use production Supabase and real credentials
POSTGRES_URL=postgresql://postgres.[prod-ref]:[prod-pw]@...
NEXT_PUBLIC_URL=https://cryptoart.social
NEYNAR_API_KEY=[production-key]

# Preview - Use staging/test database
POSTGRES_URL=postgresql://postgres.[staging-ref]:[staging-pw]@...
NEXT_PUBLIC_URL=$VERCEL_URL  # Auto-set by Vercel
NEYNAR_API_KEY=[test-key]
DEV_BYPASS_MEMBERSHIP=true

# Development - Local development
POSTGRES_URL=postgresql://localhost:5432/cryptoart
NEXT_PUBLIC_URL=http://localhost:3000
DEV_BYPASS_MEMBERSHIP=true
```

## Verification Checklist

Before deploying, ensure you have:

- [ ] `POSTGRES_URL` - Supabase pooled connection string
- [ ] `NEXT_PUBLIC_URL` - Your Vercel deployment URL
- [ ] `NEYNAR_API_KEY` - If using Farcaster features
- [ ] `KV_REST_API_URL` - If using Upstash Redis
- [ ] `KV_REST_API_TOKEN` - If using Upstash Redis
- [ ] `CRON_SECRET` - If using scheduled jobs

## Security Best Practices

1. **Never commit secrets to Git** - Use environment variables only
2. **Use different credentials** for production vs preview/development
3. **Rotate secrets regularly** - Update passwords/keys periodically
4. **Restrict access** - Only team members who need access should have Vercel project access
5. **Monitor usage** - Check Vercel logs for any unexpected API usage

## Troubleshooting

### "POSTGRES_URL environment variable is required"
- Verify `POSTGRES_URL` is set in Vercel Dashboard
- Ensure it's added to the correct environment (Production/Preview)
- Redeploy after adding the variable

### "Connection refused" or database errors
- Check if Supabase database is running
- Verify connection string format is correct
- Ensure you're using pooled connection (port 6543)
- Check Supabase Dashboard → Settings → Database → Connection Pooling

### Variables not updating
- Variables only apply to **new deployments**
- After adding/changing variables, trigger a new deployment
- Or manually redeploy from Vercel Dashboard

## Quick Reference: All Variables

```bash
# Required
POSTGRES_URL=
NEXT_PUBLIC_URL=

# Highly Recommended
NEYNAR_API_KEY=
NEYNAR_CLIENT_ID=

# Redis/Caching (Upstash)
KV_REST_API_URL=
KV_REST_API_TOKEN=

# Optional Features
CRYPTOART_HYPERSUB_CONTRACT=
DEV_BYPASS_MEMBERSHIP=
ALCHEMY_API_KEY=
AIRDROP_WALLET_PRIVATE_KEY=
CRON_SECRET=
```

For Supabase setup instructions, see [SUPABASE_SETUP.md](../../docs/SUPABASE_SETUP.md).

