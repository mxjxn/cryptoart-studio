# Quick Reference - Studio App & Contracts

## 📚 Key Documents

### For Understanding Contracts
- **[ARCHITECTURE.md](../../packages/creator-core-contracts/ARCHITECTURE.md)** - Deep dive into how contracts work
- **[DEPLOYMENT_GUIDE.md](../../packages/creator-core-contracts/DEPLOYMENT_GUIDE.md)** - How to deploy contracts
- **[DEPLOYMENTS.md](../../packages/creator-core-contracts/DEPLOYMENTS.md)** - Tracked deployments

### For Understanding Studio App
- **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Studio app architecture and development
- **[CONTRACTS_INTEGRATION.md](./CONTRACTS_INTEGRATION.md)** - How studio app connects to contracts
- **[README.md](./README.md)** - Getting started with studio app

## 🎯 TL;DR - What is What?

### Creator Core Contracts
**Location**: `packages/creator-core-contracts/`

**What**: Smart contracts that create and manage NFTs on Base network

**Key Contracts**:
- `ERC721CreatorImplementation` - For unique NFTs (1/1s)
- `ERC1155CreatorImplementation` - For editions (multiple copies)
- Uses proxy pattern (Proxy + Implementation + ProxyAdmin)

**Main Features**:
- Deploy NFT collections
- Mint NFTs (base or via extensions)
- Manage royalties
- Support extensions for custom functionality

**Documentation**: See `ARCHITECTURE.md` for full explanation

### Studio App
**Location**: `apps/cryptoart-studio-app/`

**What**: Web interface (Farcaster Mini App) for creators to use the contracts

**Key Features**:
- Deploy contracts via UI (no coding needed)
- Mint NFTs through forms
- Manage collections
- Track deployed contracts and NFTs

**Tech Stack**:
- Next.js 15 + TypeScript
- Wagmi for blockchain interaction
- Farcaster authentication
- PostgreSQL database

**Documentation**: See `DEVELOPER_GUIDE.md` and `CONTRACTS_INTEGRATION.md`

## 🔗 How They Connect

```
Studio App (UI)
    │
    ├─> User fills form → Deploys contract
    │   └─> Creates ERC721CreatorImplementation on Base
    │
    ├─> User uploads image → Mints NFT
    │   └─> Calls contract.mintBase() on deployed contract
    │
    └─> User views collections
        └─> Reads from database + blockchain
```

## 📁 Key Files

### Contracts
- `packages/creator-core-contracts/contracts/ERC721CreatorImplementation.sol` - Main NFT contract
- `packages/creator-core-contracts/script/DeployAndMintCollection.s.sol` - Deployment script

### Studio App
- `apps/cryptoart-studio-app/src/components/studio/ContractDeployer.tsx` - Deploy contracts UI
- `apps/cryptoart-studio-app/src/components/studio/NFTMinter.tsx` - Mint NFTs UI
- `apps/cryptoart-studio-app/src/app/api/studio/contracts/route.ts` - Save contracts API

## 🚀 Quick Start

### Deploy a Contract (Manual)
```bash
cd packages/creator-core-contracts
forge script script/DeployAndMintCollection.s.sol --rpc-url $RPC_URL --broadcast
```

### Run Studio App
```bash
cd apps/cryptoart-studio-app
npm install
npm run dev
```

### Deploy via Studio App (Future)
1. Open `/studio/contracts/new`
2. Fill in name, symbol, type
3. Click "Deploy"
4. Contract deployed to Base network

## 💡 Key Concepts

### Proxy Pattern
- **Proxy**: User-facing address (what you interact with)
- **Implementation**: Contains the actual logic
- **ProxyAdmin**: Controls upgrades

**Why**: Contracts are too large, proxy pattern splits them up

### Minting Types
- **1/1**: Unique NFT → `mintBase()`
- **Series**: Multiple unique NFTs → `mintBaseBatch()`
- **Edition**: Multiple copies → ERC1155 `mintBaseNew()`

### Extension System
Contracts can have "extensions" that add features:
- Custom minting logic
- Dynamic metadata
- Transfer controls
- Custom royalties

## 🐛 Current Status

### ✅ Working
- Contract deployment scripts
- Contract architecture documented
- Studio app UI components
- Database schema

### 🚧 TODO
- Studio app contract deployment implementation
- Studio app minting implementation
- IPFS upload integration
- Transaction tracking

## 📞 Need Help?

1. **Understanding contracts?** → Read `ARCHITECTURE.md`
2. **Deploying contracts?** → Read `DEPLOYMENT_GUIDE.md`
3. **Using studio app?** → Read `DEVELOPER_GUIDE.md`
4. **Connecting them?** → Read `CONTRACTS_INTEGRATION.md`

