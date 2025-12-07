# Cryptoart Monorepo

A monorepo containing all projects related to the Cryptoart channel on farcaster.

## Overview

This monorepo contains several projects that work together:

1. **MVP App** - Next.js Farcaster Mini App for the main application
2. **Creator Core Contracts** - ERC721/ERC1155 NFT framework with extensions
3. **Auctionhouse Contracts** - Solidity smart contracts for the auction house

## Related Projects

### LSSVM Development Suite (`such-lssvm`)

The [LSSVM Development Suite](https://github.com/mxjxn/such-lssvm) is a separate Turborepo monorepo that provides:

- **LSSVM Protocol Contracts** - Solidity contracts for NFT liquidity pools (sudoswap v2)
- **LSSVM Miniapp** - Farcaster miniapp for interacting with pools
- **LSSVM Subgraph** - Graph Protocol subgraph for indexing pool events
- **LSSVM ABIs Package** - Shared ABIs and types (`@lssvm/abis`)

**Integration:**
- The `cryptoart-monorepo` uses `@lssvm/abis` as a git dependency for LSSVM contract interactions
- The `unified-indexer` package bridges LSSVM pools and Auctionhouse listings
- See [LSSVM_INTEGRATION.md](./LSSVM_INTEGRATION.md) for detailed integration guide

**Why Separate?**
- Different scope: LSSVM is a protocol suite, cryptoart-monorepo is channel-specific apps
- Different deployment cycles and maintenance needs
- LSSVM has its own documentation site and can be used independently
- Cross-repo integration via git dependencies and unified indexer works well

**Repository:** [github.com/mxjxn/such-lssvm](https://github.com/mxjxn/such-lssvm)

## Project Structure

```
cryptoart-monorepo/
├── apps/
│   ├── mvp/                   # Next.js Farcaster Mini App for main application
│   └── docs/                  # Documentation site
├── packages/
│   ├── creator-core-contracts/ # ERC721/ERC1155 NFT framework
│   ├── auctionhouse-contracts/ # Solidity auction house contracts
│   ├── auctionhouse-subgraph/  # The Graph subgraph for auctionhouse events
│   ├── unified-indexer/         # Unified indexer for LSSVM pools and auctions
│   ├── creator-core-indexer/   # Creator Core event indexer
│   ├── cache/                  # Hypersub caching layer
│   ├── db/                     # Database layer with Drizzle ORM
│   ├── eslint-config/          # Shared ESLint configuration
│   ├── typescript-config/      # Shared TypeScript configuration
│   └── ui/                     # Shared UI component library
├── docs/                       # Documentation files
├── README.md                   # This file
├── turbo.json                  # Turborepo configuration
└── package.json                # Root workspace configuration
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.1.4 (package manager)
- Foundry (for contract development)
- PostgreSQL database (for apps and indexers)
- Redis (optional, for caching)

### Installation

```bash
# Install dependencies for all projects
pnpm install

# Build all projects
pnpm run build

# Run development mode for all projects
pnpm run dev
```

### Deployment

For complete deployment instructions for all projects, see **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)**.

**Quick Overview:**
1. Set up shared PostgreSQL database
2. Deploy contracts (Creator Core, Auctionhouse)
3. Deploy indexers (Creator Core Indexer)
4. Deploy subgraphs
5. Deploy apps (MVP App)

## Projects

### Apps

#### MVP App (`apps/mvp/`)

Next.js Farcaster Mini App serving as the main application for the Cryptoart channel.

**Tech Stack:**
- Next.js 15
- TypeScript
- React 18
- Tailwind CSS
- Wagmi + Viem
- Farcaster Mini App SDK

**Getting Started:**
```bash
cd apps/mvp
pnpm run dev
```

**Documentation:** See `apps/mvp/README.md`

### Packages

#### Creator Core Contracts (`packages/creator-core-contracts/`)

Extensible NFT framework based on Manifold Creator Core contracts. Supports ERC721 and ERC1155 tokens with extension system, royalties, and upgradeable implementations.

**Features:**
- ERC721/ERC1155 implementations
- Extension system for adding functionality
- Multiple royalty standards support
- Upgradeable proxy pattern support

**Documentation:** See `packages/creator-core-contracts/README.md`

**Key Files:**
- `DEPLOYMENT_GUIDE.md` - Webapp deployment guide
- `INTEGRATION_GUIDE.md` - Integration guide
- `GETTING_STARTED.md` - Getting started guide

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

#### Auctionhouse Subgraph (`packages/auctionhouse-subgraph/`)

The Graph subgraph for indexing Creator Core and Auctionhouse events on Base Mainnet. Indexes marketplace listings, purchases, bids, offers, and collection data.

**Features:**
- Marketplace event indexing (listings, purchases, bids, offers)
- Creator Core collection and token indexing
- Library event support (MarketplaceLib, SettlementLib)
- Real-time event linking and entity relationships

**Documentation:** See `packages/auctionhouse-subgraph/README.md`

#### Unified Indexer (`packages/unified-indexer/`)

Unified indexer package for querying both LSSVM pools and auctionhouse listings. Provides a single interface to fetch sales data for NFT collections.

**Features:**
- Query LSSVM pools by NFT contract
- Query auctionhouse listings by NFT contract
- Unified data structures for displaying sales

**Documentation:** See `LSSVM_INTEGRATION.md` for integration details

#### Additional Packages

The monorepo also includes several shared packages:

- **`packages/cache/`** - Hypersub caching layer
- **`packages/db/`** - Database layer with Drizzle ORM (includes such-gallery schema)
- **`packages/eslint-config/`** - Shared ESLint configuration
- **`packages/typescript-config/`** - Shared TypeScript configuration
- **`packages/ui/`** - Shared UI component library

For detailed information about these packages, see **`PACKAGES.md`**.

## Development Workflow

### Using Turborepo

This monorepo uses [Turborepo](https://turbo.build/) for managing builds and tasks across projects.

**Common Commands:**
```bash
# Build all projects
pnpm run build

# Run development mode for all apps
pnpm run dev

# Run tests for all projects
pnpm run test

# Lint all projects
pnpm run lint

# Clean all build artifacts
pnpm run clean
```

### Working on a Single Project

You can work on individual projects directly:

```bash
# Frontend development
cd apps/mvp
pnpm run dev

# Contract development
cd packages/auctionhouse-contracts
forge build
forge test
```

## Documentation

### For Humans

- **README.md** (this file) - High-level overview and getting started
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Complete deployment guide for all projects
- **[PACKAGES.md](./docs/PACKAGES.md)** - Documentation for additional shared packages
- **Project-specific READMEs** - See each project's directory for detailed documentation

### For LLMs/AI

- **[llms-full.md](./docs/llms-full.md)** - Complete technical documentation consolidated from all projects
  - Includes architecture, deployment guides, quick references, and technical notes
  - Use this for comprehensive understanding of the codebase

## Contract Addresses

For a complete list of all contract addresses across all networks, see **[CONTRACT_ADDRESSES.md](./docs/CONTRACT_ADDRESSES.md)**.

This includes:
- Auctionhouse contracts
- LSSVM contracts (Router, Factory, Bonding Curves)
- Creator Core contract deployments
- Manifold extension contracts

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests pass (`pnpm run test`)
4. Ensure linting passes (`pnpm run lint`)
5. Submit a pull request

## License

See individual project directories for license information.

## Related Links

### External Documentation
- [Manifold Creator Core Documentation](https://docs.manifold.xyz/v/manifold-for-developers/manifold-creator-architecture/overview)
- [Farcaster Mini Apps Documentation](https://docs.neynar.com/docs/create-farcaster-miniapp-in-60s)
- [Foundry Documentation](https://book.getfoundry.sh/)
- [Turborepo Documentation](https://turbo.build/repo/docs)

### Related Repositories
- **[LSSVM Development Suite](https://github.com/mxjxn/such-lssvm)** - Protocol contracts, miniapp, and subgraph for NFT liquidity pools
  - Documentation: [mxjxn.github.io/such-lssvm](https://mxjxn.github.io/such-lssvm/)
  - Integration Guide: [LSSVM_INTEGRATION.md](./LSSVM_INTEGRATION.md)

