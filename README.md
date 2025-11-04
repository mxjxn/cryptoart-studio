# Cryptoart Monorepo

A monorepo containing all projects related to the Cryptoart channel on farcaster.

## Overview

This monorepo contains several projects that work together:

1. **Cryptoart Studio App** - Next.js Farcaster Mini App for creator tools
2. **Backend** - Event indexer for blockchain events
3. **Creator Core** - ERC721/ERC1155 NFT framework with extensions
4. **Auctionhouse Contracts** - Solidity smart contracts for the auction house

## Project Structure

```
cryptoart-monorepo/
├── apps/
│   ├── cryptoart-studio-app/  # Next.js Farcaster Mini App
│   └── backend/                # Event indexer for Base network
├── packages/
│   ├── creator-core/          # ERC721/ERC1155 NFT framework
│   └── auctionhouse-contracts/ # Solidity auction house contracts
├── llms-full.md               # Complete technical documentation
├── README.md                   # This file
├── turbo.json                  # Turborepo configuration
└── package.json                # Root workspace configuration
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 10.0.0
- Foundry (for contract development)

### Installation

```bash
# Install dependencies for all projects
npm install

# Build all projects
npm run build

# Run development mode for all projects
npm run dev
```

## Projects

### Apps

#### Cryptoart Studio App (`apps/cryptoart-studio-app/`)

Next.js Farcaster Mini App for creator tools, subscription management, and community analytics.

**Tech Stack:**
- Next.js 15
- TypeScript
- React 18
- Tailwind CSS
- Wagmi + Viem
- Farcaster Mini App SDK

**Getting Started:**
```bash
cd apps/cryptoart-studio-app
npm run dev
```

**Documentation:** See `apps/cryptoart-studio-app/README.md` and `apps/cryptoart-studio-app/DEVELOPER_GUIDE.md`

#### Backend (`apps/backend/`)

Event indexer that listens to blockchain events from the auction house contract and stores them for faster client-side retrieval.

**Tech Stack:**
- Node.js
- Ethers.js
- Alchemy RPC

**Getting Started:**
```bash
cd apps/backend
npm start
```

**Documentation:** See `apps/backend/guide.md`

### Packages

#### Creator Core (`packages/creator-core/`)

Extensible NFT framework based on Manifold Creator Core contracts. Supports ERC721 and ERC1155 tokens with extension system, royalties, and upgradeable implementations.

**Features:**
- ERC721/ERC1155 implementations
- Extension system for adding functionality
- Multiple royalty standards support
- Upgradeable proxy pattern support

**Documentation:** See `packages/creator-core/README.md`

**Key Files:**
- `ARCHITECTURE.md` - Detailed architecture documentation
- `DEPLOYMENT_GUIDE.md` - Webapp deployment guide
- `QUICK_REFERENCE.md` - Quick reference for common operations

#### Auctionhouse Contracts (`packages/auctionhouse-contracts/`)

Solidity smart contracts for the auction house, forked from Manifold Gallery with modifications for the Cryptoart channel.

**Features:**
- Listing creation with events
- Seller registry linked to hypersub membership
- Multiple auction types

**Documentation:** See `packages/auctionhouse-contracts/README.md`

**Development:**
```bash
cd packages/auctionhouse-contracts
forge build
forge test
```

## Development Workflow

### Using Turborepo

This monorepo uses [Turborepo](https://turbo.build/) for managing builds and tasks across projects.

**Common Commands:**
```bash
# Build all projects
npm run build

# Run development mode for all apps
npm run dev

# Run tests for all projects
npm run test

# Lint all projects
npm run lint

# Clean all build artifacts
npm run clean
```

### Working on a Single Project

You can work on individual projects directly:

```bash
# Frontend development
cd apps/cryptoart-studio-app
npm run dev

# Backend development
cd apps/backend
npm start

# Contract development
cd packages/auctionhouse-contracts
forge build
forge test
```

## Documentation

### For Humans

- **README.md** (this file) - High-level overview and getting started
- **Project-specific READMEs** - See each project's directory for detailed documentation

### For LLMs/AI

- **llms-full.md** - Complete technical documentation consolidated from all projects
  - Includes architecture, deployment guides, quick references, and technical notes
  - Use this for comprehensive understanding of the codebase

## Contract Addresses

### Mainnet (Base)

- **Auctionhouse Contract**: `0x1cb0c1f72ba7547fc99c4b5333d8aba1ed6b31a9`
- **Network**: Base Mainnet (Chain ID: 8453)

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests pass (`npm run test`)
4. Ensure linting passes (`npm run lint`)
5. Submit a pull request

## License

See individual project directories for license information.

## Related Links

- [Manifold Creator Core Documentation](https://docs.manifold.xyz/v/manifold-for-developers/manifold-creator-architecture/overview)
- [Farcaster Mini Apps Documentation](https://docs.neynar.com/docs/create-farcaster-miniapp-in-60s)
- [Foundry Documentation](https://book.getfoundry.sh/)
- [Turborepo Documentation](https://turbo.build/repo/docs)

