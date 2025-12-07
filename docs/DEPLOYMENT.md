# Deployment Guide

This document provides an overview of deployment for all projects in the cryptoart-monorepo. Each project has specific deployment requirements and instructions.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Shared Infrastructure](#shared-infrastructure)
- [Apps](#apps)
- [Packages](#packages)
- [Deployment Order](#deployment-order)

## Prerequisites

### Required Software

- **Node.js** >= 18.0.0
- **pnpm** >= 9.1.4
- **Foundry** (for contract development)
- **PostgreSQL** database (shared across projects)
- **Redis** (optional, for caching - shared across projects)

### Environment Variables

All projects share certain environment variables. See [Shared Infrastructure](#shared-infrastructure) for details.

## Shared Infrastructure

### Database Setup

All projects share the same PostgreSQL database and Redis instance.

**PostgreSQL:**
- Set `POSTGRES_URL` environment variable
- Format: `postgres://user:password@host:port/database`
- Run migrations: `cd packages/db && pnpm run db:push`

**Redis (Optional):**
- Option 1 (Upstash): Set `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- Option 2 (Standard): Set `REDIS_URL`
- See `packages/shared-db-config/README.md` for details

### Database Migrations

After schema changes, run:

```bash
cd packages/db
pnpm run db:push
```

## Apps

### MVP App

**Location**: `apps/mvp/`

**Deployment**: Vercel (recommended) or any Next.js-compatible platform

**Quick Deploy:**
```bash
cd apps/mvp
npm run build
# Deploy to your platform
```

**Environment Variables:**
- `NEYNAR_API_KEY` - Neynar API key
- `NEYNAR_CLIENT_ID` - Neynar client ID
- `POSTGRES_URL` - Shared database connection
- `NEXT_PUBLIC_URL` - Public URL of the app
- `ALCHEMY_API_KEY` - For NFT metadata (optional)
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` - Redis (optional)

**Documentation:**
- See `apps/mvp/README.md`

## Packages

### Creator Core Indexer

**Location**: `packages/creator-core-indexer/`

**Deployment**: Railway, Render, or any Node.js hosting platform (as background worker)

**Running:**
```bash
cd packages/creator-core-indexer
pnpm install
pnpm run build
pnpm run start
```

**Environment Variables:**
- `POSTGRES_URL` - Shared database connection (required)
- `RPC_URL` - Base network RPC endpoint (required)
- `CHAIN_ID` - Chain ID (default: 8453)
- `START_BLOCK` - Block to start indexing from (optional)
- `BATCH_SIZE` - Blocks per batch (default: 100)
- `POLL_INTERVAL` - Polling interval in ms (default: 12000)
- `ERC721_IMPLEMENTATION_ADDRESSES` - Comma-separated addresses (optional)
- `ERC1155_IMPLEMENTATION_ADDRESSES` - Comma-separated addresses (optional)
- `ERC6551_IMPLEMENTATION_ADDRESSES` - Comma-separated addresses (optional)

**Documentation:**
- See `packages/creator-core-indexer/README.md`
- See `packages/creator-core-indexer/DEPLOYMENT.md` for deployment options
- See `packages/creator-core-indexer/ENV_VARS.md` for environment variables

### Creator Core Contracts

**Location**: `packages/creator-core-contracts/`

**Deployment**: On-chain contract deployment (Base network)

**Deployment Methods:**
1. Direct deployment (non-upgradeable)
2. Proxy deployment (upgradeable)
3. DeploymentProxy (CREATE2 deterministic)

**Quick Deploy:**
```bash
cd packages/creator-core-contracts
forge script script/DeployCreatorCore.s.sol --rpc-url $RPC_URL --broadcast
```

**Documentation:**
- See `packages/creator-core-contracts/DEPLOYMENT_GUIDE.md` - Comprehensive deployment guide
- See `packages/creator-core-contracts/DEPLOYMENTS.md` - Deployment tracking
- See `packages/creator-core-contracts/GETTING_STARTED.md` - Getting started guide
- See `packages/creator-core-contracts/INTEGRATION_GUIDE.md` - Integration guide

### Auctionhouse Contracts

**Location**: `packages/auctionhouse-contracts/`

**Deployment**: On-chain contract deployment (Base network)

**Quick Deploy:**
```bash
cd packages/auctionhouse-contracts
forge script script/DeployContracts.s.sol --rpc-url $RPC_URL --broadcast
```

**Documentation:**
- See `packages/auctionhouse-contracts/DEPLOYMENT.md` - Deployment guide
- See `packages/auctionhouse-contracts/README.md` - Overview and features

### Subgraphs

#### Creator Core & Auctionhouse Subgraph

**Location**: `packages/subgraph/`

**Deployment**: The Graph Studio or Alchemy Subgraph

**Deploy to The Graph Studio:**
```bash
cd packages/subgraph
graph auth --studio <DEPLOY_KEY>
npm run deploy
```

**Deploy to Alchemy:**
```bash
npm run deploy:alchemy
```

**Documentation:**
- See `packages/subgraph/README.md` - Setup and deployment instructions

#### Auctionhouse Subgraph

**Location**: `packages/auctionhouse-subgraph/`

**Deployment**: The Graph Studio or Alchemy Subgraph

**Documentation:**
- See `packages/auctionhouse-subgraph/README.md` - Setup and deployment instructions

## Deployment Order

For a complete deployment, follow this order:

### 1. Infrastructure Setup

1. **Set up shared database:**
   ```bash
   # Create PostgreSQL database
   # Set POSTGRES_URL environment variable
   ```

2. **Set up Redis (optional):**
   ```bash
   # Create Redis instance (Upstash or standard)
   # Set KV_REST_API_URL/KV_REST_API_TOKEN or REDIS_URL
   ```

3. **Run database migrations:**
   ```bash
   cd packages/db
   pnpm run db:push
   ```

### 2. Contract Deployment

1. **Deploy Creator Core Contracts:**
   ```bash
   cd packages/creator-core-contracts
   # Follow DEPLOYMENT_GUIDE.md
   ```

2. **Deploy Auctionhouse Contracts:**
   ```bash
   cd packages/auctionhouse-contracts
   # Follow DEPLOYMENT.md
   ```

3. **Update contract addresses:**
   - Update `CONTRACT_ADDRESSES.md` with deployed addresses
   - Update subgraph configurations with contract addresses

### 3. Indexer Services

1. **Deploy Creator Core Indexer:**
   ```bash
   cd packages/creator-core-indexer
   # Deploy as background worker
   # See DEPLOYMENT.md for options
   ```

### 4. Subgraph Deployment

1. **Deploy Creator Core & Auctionhouse Subgraph:**
   ```bash
   cd packages/subgraph
   # Deploy to The Graph Studio or Alchemy
   ```

2. **Deploy Auctionhouse Subgraph (if separate):**
   ```bash
   cd packages/auctionhouse-subgraph
   # Deploy to The Graph Studio or Alchemy
   ```

### 5. App Deployment

1. **Deploy MVP App:**
   ```bash
   cd apps/mvp
   npm run build
   # Deploy to your platform
   ```

## Environment Variable Checklist

### Required for All Apps

- `POSTGRES_URL` - Shared database connection
- `NEYNAR_API_KEY` - Neynar API key
- `NEYNAR_CLIENT_ID` - Neynar client ID
- `NEXT_PUBLIC_URL` - Public URL of the app

### Optional

- `KV_REST_API_URL` / `KV_REST_API_TOKEN` - Upstash Redis
- `REDIS_URL` - Standard Redis
- `ALCHEMY_API_KEY` - For NFT metadata

### Indexer-Specific

- `RPC_URL` - Base network RPC endpoint
- `CHAIN_ID` - Chain ID (default: 8453)
- `START_BLOCK` - Starting block for indexing
- `BATCH_SIZE` - Indexing batch size
- `POLL_INTERVAL` - Polling interval

### Contract-Specific

- `PRIVATE_KEY` - Deployer private key (for contract deployment)
- `RPC_URL` - Network RPC endpoint

## Troubleshooting

### Database Connection Issues

- Verify `POSTGRES_URL` is correct
- Check database is accessible from deployment platform
- Ensure database schema is up to date (`pnpm run db:push`)

### Indexer Not Starting

- Check `POSTGRES_URL` and `RPC_URL` are set
- Verify RPC endpoint is accessible
- Check database schema includes Creator Core tables

### Contract Deployment Failures

- Verify `PRIVATE_KEY` has sufficient funds
- Check `RPC_URL` points to correct network
- Ensure contract size limits are not exceeded (use proxy pattern)

### Subgraph Deployment Issues

- Verify contract addresses in `subgraph.yaml`
- Check start blocks are correct
- Ensure ABIs are up to date

## Related Documentation

- [Main README](./README.md) - Project overview
- [PACKAGES.md](./PACKAGES.md) - Package documentation
- [CONTRACT_ADDRESSES.md](./CONTRACT_ADDRESSES.md) - Contract addresses
- [LSSVM_INTEGRATION.md](./LSSVM_INTEGRATION.md) - LSSVM integration guide

