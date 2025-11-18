# Environment Variables

This document lists the environment variables needed for the cryptoart-studio-app.

## Required for Basic Functionality

### `NEXT_PUBLIC_URL`
- **Description**: The base URL of your application
- **Examples**: 
  - Local: `http://localhost:3000`
  - Ngrok: `https://rubidic-lily-aversely.ngrok-free.dev`
  - Production: `https://your-domain.com`
- **Note**: If not set, defaults to `window.location.origin` in browser or `http://localhost:3000` on server
- **For Ngrok Testing**: Use your ngrok HTTPS URL (must include `https://` protocol)

## Optional (for Neynar Features)

### `NEYNAR_API_KEY`
- **Description**: Your Neynar API key for Farcaster integration
- **Required for**: 
  - User lookups
  - Channel data
  - Subscriptions (if using)
  - Notifications
- **Note**: If not set, Neynar features will be disabled gracefully (no errors thrown)

### `NEYNAR_CLIENT_ID`
- **Description**: Your Neynar client ID
- **Required for**: Webhook configuration
- **Note**: Only needed if using Neynar webhooks

## Optional (for Other Features)

### `CRYPTOART_HYPERSUB_CONTRACT`
- **Description**: Contract address for CryptoArt Hypersub membership validation
- **Note**: Only needed if using membership validation

### `DEV_BYPASS_MEMBERSHIP`
- **Description**: Set to `'true'` to bypass membership validation in development
- **Example**: `DEV_BYPASS_MEMBERSHIP=true`

### `ALCHEMY_API_KEY`
- **Description**: Alchemy API key for blockchain data
- **Note**: Only needed for NFT/blockchain queries

### `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- **Description**: Upstash KV (Redis) credentials for caching
- **Note**: Only needed if using caching features

### `AIRDROP_WALLET_PRIVATE_KEY`
- **Description**: Private key for airdrop wallet
- **Note**: Only needed for airdrop functionality

### `CRON_SECRET`
- **Description**: Secret for cron job authentication
- **Note**: Only needed for scheduled sync jobs

## Quick Start

For basic pool testing on Base Sepolia, you only need:

```bash
# Local development
NEXT_PUBLIC_URL=http://localhost:3000

# Or with ngrok for external access/testing
NEXT_PUBLIC_URL=https://rubidic-lily-aversely.ngrok-free.dev
```

Neynar features will work without the API key, but some features will be disabled.

## Setting Up with Ngrok

If you're using ngrok for testing (e.g., for webhooks or mobile testing):

1. **Start ngrok** pointing to your local server:
   ```bash
   ngrok http 3000
   ```

2. **Copy your ngrok HTTPS URL** (e.g., `https://rubidic-lily-aversely.ngrok-free.dev`)

3. **Set in your `.env.local` file**:
   ```bash
   NEXT_PUBLIC_URL=https://rubidic-lily-aversely.ngrok-free.dev
   ```

4. **Restart your dev server** for the change to take effect

**Note**: Ngrok URLs change when you restart ngrok (unless you have a paid plan with a static domain). Update `NEXT_PUBLIC_URL` if your ngrok URL changes.

