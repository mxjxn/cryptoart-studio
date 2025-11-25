# Quick Reference - Studio App & Contracts

## 📚 Key Documents

### For Understanding Studio App
- **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Studio app architecture and development
- **[README.md](./README.md)** - Getting started with studio app
- **[DUAL_MODE_GUIDE.md](./DUAL_MODE_GUIDE.md)** - Dual-mode operation (Mini-App & Regular Web3)
- **[ENV_VARS.md](./ENV_VARS.md)** - Environment variables configuration

## 🎯 TL;DR - What is This?

### CryptoArt Studio App
**Location**: `apps/cryptoart-studio-app/`

**What**: Web interface (Farcaster Mini App) for creators to manage crypto art communities

**Key Features**:
- Manage NFT collections and contracts
- Create and manage auctions
- Deploy LSSVM pools for NFT trading
- Airdrop tokens to community members
- Track subscriptions and memberships
- Channel activity analytics

**Tech Stack**:
- Next.js 15 + TypeScript
- Wagmi for blockchain interaction
- Farcaster authentication
- PostgreSQL database

**Documentation**: See `DEVELOPER_GUIDE.md` for full details

## 🔗 How It Works

```
Studio App (UI)
    │
    ├─> User creates auction → Deploys to auctionhouse contract
    │   └─> Creates auction on Base network
    │
    ├─> User creates LSSVM pool → Deploys pool for NFT trading
    │   └─> Calls LSSVM factory on deployed contract
    │
    └─> User views collections
        └─> Reads from database + blockchain via indexers
```

## 📁 Key Files

### Studio App
- `apps/cryptoart-studio-app/src/components/studio/ContractDeployer.tsx` - Deploy contracts UI
- `apps/cryptoart-studio-app/src/components/studio/CreateAuctionForm.tsx` - Create auctions UI
- `apps/cryptoart-studio-app/src/components/studio/CreatePoolForm.tsx` - Create LSSVM pools UI
- `apps/cryptoart-studio-app/src/components/studio/NFTMinter.tsx` - Mint NFTs UI
- `apps/cryptoart-studio-app/src/app/api/studio/contracts/route.ts` - Contracts API
- `apps/cryptoart-studio-app/src/app/api/studio/auctions/route.ts` - Auctions API

## 🚀 Quick Start

### Run Studio App
```bash
cd apps/cryptoart-studio-app
npm install
npm run dev
```

### Environment Setup
See [ENV_VARS.md](./ENV_VARS.md) for required environment variables.

## 💡 Key Concepts

### Proxy Pattern
- **Proxy**: User-facing address (what you interact with)
- **Implementation**: Contains the actual logic
- **ProxyAdmin**: Controls upgrades

**Why**: Contracts are too large, proxy pattern splits them up

### Minting Types
- **1/1**: Unique NFT
- **Series**: Multiple unique NFTs
- **Edition**: Multiple copies of the same NFT

## 🐛 Current Status

### ✅ Working
- Studio app UI components
- LSSVM pool creation
- Auction creation and management
- Collection tracking
- Database schema
- API endpoints

### 🚧 In Development
- Enhanced NFT metadata management
- Advanced pool configuration
- Multi-chain support

## 📞 Need Help?

1. **Using studio app?** → Read `DEVELOPER_GUIDE.md`
2. **Environment setup?** → Read `ENV_VARS.md`
3. **Dual-mode operation?** → Read `DUAL_MODE_GUIDE.md`

