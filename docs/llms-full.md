# Cryptoart Monorepo - Complete Technical Documentation

> **Note**: This document consolidates all technical documentation from the monorepo projects. For project-specific documentation, see the individual project directories:
> - Creator Core: `packages/creator-core-contracts/`
> - Auctionhouse Contracts: `packages/auctionhouse-contracts/`
> - Backend: `apps/backend/`
> - Cryptoart Studio App: `apps/cryptoart-studio-app/`

---

## Table of Contents

1. [Creator Core Contracts](#creator-core-contracts)
   - [Overview](#creator-core-overview)
   - [Architecture](#creator-core-architecture)
   - [Deployment Guide](#creator-core-deployment)
   - [Quick Reference](#creator-core-quick-reference)
2. [Auctionhouse Contracts](#auctionhouse-contracts)
   - [Overview](#auctionhouse-contracts-overview)
   - [Contract Information](#auctionhouse-contract-info)
3. [Backend (Indexer)](#backend-indexer)
   - [Overview](#backend-overview)
   - [Implementation Guide](#backend-implementation)
   - [Technical Notes](#backend-technical-notes)
4. [Cryptoart Studio App](#cryptoart-studio-app)
   - [Overview](#cryptoart-studio-app-overview)
   - [Development Guide](#cryptoart-studio-app-development)

---

# Creator Core Contracts

## Creator Core Overview

**Source**: `packages/creator-core-contracts/README.md`

The Manifold Creator Core contracts provide creators with the ability to deploy an ERC721/ERC1155 NFT smart contract with basic minting functionality, on-chain royalties and permissioning. Additionally, they provide a framework for extending the functionality of the smart contract by installing extension applications.

These contracts are used in the [Manifold Studio](https://studio.manifoldxyz.dev/).

### Installation

```bash
npm install @manifoldxyz/creator-core-solidity
```

### Usage

```solidity
pragma solidity ^0.8.0;

import "@manifoldxyz/creator-core-solidity/contracts/ERC721Creator.sol";

contract MyContract is ERC721Creator {
    constructor() ERC721Creator("MyContract", "MC") {}
}
```

### Available Contracts

- `ERC721Creator` - Non-upgradeable ERC721 implementation
- `ERC721CreatorUpgradeable` - Transparent proxy upgradeable version
- `ERC721CreatorEnumerable` - Enumerable version (note: ~2x higher mint costs)
- `ERC1155Creator` - Non-upgradeable ERC1155 implementation

### Extension Applications

Extensions can override:
- **ERC721**: mint, tokenURI, transferFrom/safeTransferFrom pre-transfer check, burn pre-burn check, royalties
- **ERC1155**: mint, uri, safeTransferFrom pre-transfer check, burn pre-burn check, royalties

Example applications: [creator-core-extensions-solidity](https://github.com/manifoldxyz/creator-core-extensions-solidity)

---

## Creator Core Architecture

**Source**: `packages/creator-core-contracts/ARCHITECTURE.md`

### System Overview

The Creator Core contracts implement an extensible NFT framework that allows for:
- **Modular functionality** through an extension system
- **Multiple royalty standards** support
- **Flexible URI management** with multiple resolution strategies
- **Admin-controlled permissions** for contract management
- **Upgradeable implementations** via proxy patterns

### Core Design Principles

1. **Extensibility**: New features can be added without modifying core contracts
2. **Backward Compatibility**: Supports multiple royalty standards simultaneously
3. **Gas Efficiency**: Optimized for common operations while maintaining flexibility
4. **Security**: Multi-layer permission system with admin controls

### Contract Hierarchy

```
ERC721Creator / ERC1155Creator
├── AdminControl (or AdminControlUpgradeable)
│   └── Access control for admins
├── ERC721Base / ERC1155Base
│   ├── ERC721Core / ERC1155Core
│   │   └── Standard ERC721/ERC1155 implementation
│   └── Token metadata and storage
└── ERC721CreatorCore / ERC1155CreatorCore
    └── CreatorCore
        ├── Extension management
        ├── URI resolution
        ├── Royalty management
        └── Permission hooks
```

### Key Contracts

#### CreatorCore.sol

Provides:
1. **Extension Registry**
   - `_extensions`: Set of registered extension addresses
   - `_blacklistedExtensions`: Set of blacklisted extensions
   - `_extensionToIndex`: Mapping from extension to internal index
   - `_indexToExtension`: Mapping from index to extension address

2. **URI Management**
   - `_extensionBaseURI`: Base URI per extension
   - `_extensionBaseURIIdentical`: Whether extension uses identical URIs
   - `_extensionURIPrefix`: URI prefix per extension
   - `_tokenURIs`: Token-specific URI overrides

3. **Royalty Configuration**
   - `_extensionRoyalty`: Royalties per extension
   - `_tokenRoyalty`: Royalties per token
   - Supports multiple recipients and basis points

4. **Token Tracking**
   - `_tokenCount`: Total number of tokens minted

#### ERC721CreatorCore.sol / ERC1155CreatorCore.sol

Token-specific creator functionality:

**ERC721 Specific:**
- `mintBase()`: Admin minting without extension
- `mintExtension()`: Extension-based minting
- `tokenExtension()`: Returns extension that created token
- `tokenData()`: Returns custom data stored with token

**ERC1155 Specific:**
- `mintBaseNew()`: Mint new token IDs
- `mintBaseExisting()`: Mint existing token IDs
- `mintExtensionNew()`: Extension minting new token IDs
- `mintExtensionExisting()`: Extension minting existing token IDs

### Extension System

#### Extension Registration

Extensions are registered via `registerExtension()`:

```solidity
function registerExtension(address extension, string calldata baseURI, bool baseURIIdentical)
```

**Process:**
1. Validates extension is a contract
2. Validates extension is not blacklisted
3. Adds extension to `_extensions` set
4. Stores extension base URI configuration
5. Sets up transfer approval delegation (if enabled)

#### Extension Capabilities

Extensions can override:
1. **Minting** - `mintExtension()` functions
2. **Token URI** - Implement `ICreatorExtensionTokenURI`
3. **Transfers** - Implement `IERC721CreatorExtensionApproveTransfer`
4. **Burns** - Implement `IERC721CreatorExtensionBurnable`
5. **Royalties** - Implement `ICreatorExtensionRoyalties`

### Royalty System

#### Royalty Standards Support

The contracts support four royalty standards:
1. **EIP-2981** (`royaltyInfo`) - Single recipient
2. **Rarible V1** (`getFeeRecipients`, `getFeeBps`) - Multiple recipients
3. **Foundation** (`getFees`) - Multiple recipients
4. **CreatorCore** (`getRoyalties`) - Native format

#### Royalty Resolution Priority

1. **Token-specific royalties** (`_tokenRoyalty[tokenId]`)
2. **Extension-provided royalties** (if extension implements `ICreatorExtensionRoyalties`)
3. **Extension-level royalties** (`_extensionRoyalty[extension]`)
4. **Default royalties** (`_extensionRoyalty[address(0)]`)

### URI Resolution

The `tokenURI()` function resolves URIs in this order:
1. **Token-specific URI** (`_tokenURIs[tokenId]`)
2. **Extension-provided URI** (if extension implements `ICreatorExtensionTokenURI`)
3. **Extension base URI** (with or without tokenId)
4. **Default base URI**

### Permission System

#### Admin Control

Uses `AdminControl` from Manifold libraries:
- **Owner**: Contract owner (set during deployment)
- **Admins**: Array of admin addresses
- **Extensions**: Registered extensions (can call extension functions)

**Admin Functions:**
- `registerExtension()`, `unregisterExtension()`, `blacklistExtension()`
- `setRoyalties()`, `setTokenURI()`, `setBaseTokenURI()`
- `mintBase()` (for base minting)

#### Mint Permissions

Extensions can have mint permission contracts that implement:
```solidity
interface IERC721CreatorMintPermissions {
    function approveMint(address extension, address to, uint256 tokenId) external;
}
```

### Security Considerations

- **Access Control**: Admin functions protected by `adminRequired` modifier
- **Reentrancy Protection**: Uses `ReentrancyGuard` from OpenZeppelin
- **Input Validation**: Validates royalties, extensions, tokens
- **Blacklisting**: Prevents malicious extensions from functioning
- **Upgrade Safety**: Proxy upgrades must maintain storage layout compatibility

---

## Creator Core Deployment

**Source**: `packages/creator-core-contracts/DEPLOYMENT_GUIDE.md`

### Deployment Methods

#### Method 1: Direct Deployment (Non-Upgradeable)

For `ERC721Creator`, `ERC1155Creator`:

```javascript
const factory = new ethers.ContractFactory(abi, bytecode, signer);
const contract = await factory.deploy("My NFT", "MNFT");
await contract.deployed();
```

#### Method 2: Proxy Deployment (Upgradeable)

For `ERC721CreatorUpgradeable`, `ERC1155CreatorUpgradeable`:

```javascript
// 1. Deploy implementation
const implFactory = new ethers.ContractFactory(implABI, implBytecode, signer);
const impl = await implFactory.deploy();
await impl.deployed();

// 2. Encode init data
const initData = impl.interface.encodeFunctionData('initialize', ['Name', 'SYMBOL']);

// 3. Deploy proxy
const proxyFactory = new ethers.ContractFactory(proxyABI, proxyBytecode, signer);
const proxy = await proxyFactory.deploy(impl.address, proxyAdmin, initData);
await proxy.deployed();

// 4. Use contract
const contract = new ethers.Contract(proxy.address, implABI, signer);
```

#### Method 3: DeploymentProxy (Deterministic CREATE2)

Uses CREATE2 for deterministic contract addresses. Useful for factory patterns.

### Common Operations

#### Minting

```javascript
// Mint single token (admin)
await contract.mintBase(toAddress);
await contract.mintBase(toAddress, "ipfs://...");

// Mint batch (admin)
await contract.mintBaseBatch(toAddress, 10);
await contract.mintBaseBatch(toAddress, ["ipfs://1", "ipfs://2"]);

// Mint via extension (extension only)
await contract.mintExtension(toAddress);
```

#### Setting Royalties

```javascript
// Set default royalties (5% to creator)
await contract.setRoyalties(
  [creatorAddress],
  [500] // 500 basis points = 5%
);

// Set token-specific royalties
await contract.setRoyalties(
  tokenId,
  [recipient1, recipient2],
  [500, 250] // 5% and 2.5%
);

// Get royalties
const [receivers, bps] = await contract.getRoyalties(tokenId);

// EIP-2981
const [receiver, amount] = await contract.royaltyInfo(tokenId, salePrice);
```

#### URI Management

```javascript
// Set base URI
await contract.setBaseTokenURI("ipfs://QmHash/");

// Set token URI
await contract.setTokenURI(tokenId, "ipfs://QmHash/token.json");

// Set URI prefix
await contract.setTokenURIPrefix("ipfs://");

// Get token URI
const uri = await contract.tokenURI(tokenId);
```

#### Registering Extensions

```javascript
// Register extension
await contract.registerExtension(extensionAddress, "https://api.example.com/");

// Register with identical URI
await contract.registerExtension(extensionAddress, "https://api.example.com/metadata.json", true);

// Unregister extension
await contract.unregisterExtension(extensionAddress);

// Blacklist extension
await contract.blacklistExtension(extensionAddress);
```

### Gas Estimates

| Operation | Gas Cost (approx) |
|-----------|-------------------|
| Deploy ERC721Creator | ~3,500,000 |
| Deploy ERC721CreatorUpgradeable (impl) | ~3,800,000 |
| Deploy Proxy | ~1,200,000 |
| Mint Base (single) | ~80,000 |
| Mint Base Batch (10) | ~650,000 |
| Register Extension | ~150,000 |
| Set Royalties | ~100,000 |
| Set Token URI | ~50,000 |

---

## Creator Core Quick Reference

**Source**: `packages/creator-core-contracts/QUICK_REFERENCE.md`

### Contract Addresses & ABIs

After compiling with Foundry:
```bash
forge build
```

Artifacts are in `out/`:
- ABI: `out/ERC721Creator.sol/ERC721Creator.json` → `abi` field
- Bytecode: `out/ERC721Creator.sol/ERC721Creator.json` → `bytecode` field

### Interface IDs

```javascript
// ERC721
const ERC721_INTERFACE_ID = "0x80ac58cd";

// ERC721Metadata
const ERC721_METADATA_INTERFACE_ID = "0x5b5e139f";

// ERC721Enumerable
const ERC721_ENUMERABLE_INTERFACE_ID = "0x780e9d63";

// ERC1155
const ERC1155_INTERFACE_ID = "0xd9b67a26";

// ERC1155MetadataURI
const ERC1155_METADATA_URI_INTERFACE_ID = "0x0e89341c";

// EIP-2981 Royalties
const EIP2981_INTERFACE_ID = "0x2a55205a";
```

### Common Errors

```solidity
"Must be registered extension"        // Extension not registered
"Extension blacklisted"                // Extension is blacklisted
"Invalid token"                        // Token doesn't exist
"Nonexistent token"                    // Token ID invalid
"Invalid input"                       // Array length mismatch
"Invalid total royalties"             // Basis points >= 10000
"Caller is not owner or approved"     // Not authorized
```

### Storage Slots (Proxy)

```javascript
// Implementation slot
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

// Admin slot
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

// Read implementation
const implementation = await provider.getStorageAt(proxyAddress, IMPLEMENTATION_SLOT);
```

---

# Auctionhouse Contracts

## Auctionhouse Contracts Overview

**Source**: `packages/auctionhouse-contracts/README.md`

This is a fork of the [Manifold Gallery](https://gallery.manifold.xyz) Auctionhouse contracts, written for the [Cryptoart](https://warpcast.com/~/channel/cryptoart) channel on Farcaster.

### Main Differences

- New listings emit an event upon creation
- The seller registry is linked to active hypersub membership (STP v2 NFT's `balanceOf` function returns time-remaining)

### Foundry Usage

```bash
# Build
forge build

# Test
forge test

# Format
forge fmt

# Gas Snapshots
forge snapshot

# Anvil (local node)
anvil

# Deploy
forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

---

## Auctionhouse Contract Info

**Source**: `apps/backend/guide.md`

### Auction House Contract

- **Address**: `0x1cb0c1f72ba7547fc99c4b5333d8aba1ed6b31a9`
- **Network**: Base Mainnet (Chain ID: 8453)
- **Purpose**: Manages the core auction functionality

#### Key Events

- `AuctionCreated`: Emitted when a new auction is created
- `AuctionBid`: Emitted when a bid is placed
- `AuctionSettled`: Emitted when an auction is settled
- `AuctionCanceled`: Emitted when an auction is canceled

### Marketplace Library Events

The contract uses library events that are not in the main contract ABI:

**Admin Configuration Events:**
- `SetFees(address,uint16,uint16)`
- `SetRoyaltyEnforcement(address)`
- `SetSellerRegistration(address,address)`

**Marketplace Library Events:**
- `CreateListing(uint40 indexed listingId, ...)`
- `CreateListingTokenDetails(uint40 indexed listingId, ...)`
- `CreateListingFees(uint40 indexed listingId, ...)`
- `PurchaseEvent(uint40 indexed listingId, ...)`
- `BidEvent(uint40 indexed listingId, ...)`
- `OfferEvent(uint40 indexed listingId, ...)`
- `RescindOfferEvent(uint40 indexed listingId, ...)`
- `AcceptOfferEvent(uint40 indexed listingId, ...)`
- `ModifyListing(uint40 indexed listingId, ...)`
- `CancelListing(uint40 indexed listingId, ...)`
- `FinalizeListing(uint40 indexed listingId)`

**Note**: Library events are emitted from `MarketplaceLib.sol` and must be tracked by event signature rather than ABI.

---

# Backend (Indexer)

## Backend Overview

**Source**: `apps/backend/`

The backend is an event indexer for the auction house contract on Base Mainnet. It listens to blockchain events and processes them for faster client-side retrieval.

### Current Functionality

- ✅ Connection to Base Mainnet via Alchemy RPC
- ✅ Basic contract interaction setup
- ✅ Event listening structure
- ✅ Retry logic for failed RPC calls
- ✅ Library event signature tracking

### Known Issues

1. **Contract ABI**: Current ABI is minimal and might be missing functions/events. Full ABI should be verified from Etherscan.
2. **Event Processing**: Needs testing with real events, requires more robust error handling.
3. **Token Contract Integration**: NFT contract address not specified, need to add support for querying NFT metadata.
4. **Error Handling**: Need to handle rate limiting, should add reconnection logic for WebSocket drops.

---

## Backend Implementation

**Source**: `apps/backend/guide.md`

### Configuration

Configuration is in `config.js`:

```javascript
module.exports = {
  // Network configuration
  rpcUrls: ['https://base-mainnet.g.alchemy.com/v2/{API_KEY}'],
  alchemyApiKey: process.env.ALCHEMY_API_KEY,
  
  // Contract addresses
  marketplaceAddress: '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9',
  
  // Marketplace ABI (includes library events)
  marketplaceAbi: [/* ... */],
  
  // Batch settings
  maxBlockRange: 10, // Free tier Alchemy limit
  
  // Retry settings
  maxRetries: 5,
  retryDelay: 2000 // 2 seconds
};
```

### Library Event Signatures

The indexer tracks library events by signature since they're not in the main contract ABI:

```javascript
const libraryEventSignatures = {
  '0x399d744aed2a748ad035a6b7e41fec32306c4226e1376bd0017a60b9154d9d5c': 'SetFees',
  '0x5bade386a6c8f7462e49fcd944dce32208fd2bb5d19e8a1b610a0ea61b8e37ed': 'SetRoyaltyEnforcement',
  '0x7b71aacd23ea781673f15e1659e8601ac18ec094ab50ed668f9c43175c4bad81': 'SetSellerRegistration',
  '0xa677084ea9aea69b2640d875bae622e3cf9d7c163f52d2f9d81daa1ed072c985': 'CreateListing',
  // ... more events
};
```

### Event Processing

The indexer scans blocks and processes events:

1. Connect to Alchemy RPC
2. Scan block range for transactions
3. Check transaction receipts for logs
4. Match log signatures to library events
5. Process and decode event data

### Troubleshooting

**Connection Failures:**
- Verify Alchemy API key has access to Base Mainnet
- Check network connectivity
- Ensure the Alchemy app is configured for Base Mainnet

**Event Not Capturing:**
- Verify the contract address is correct
- Check if the event signatures match the contract
- Ensure the block range being queried contains the events

**Rate Limiting:**
- The indexer includes basic rate limiting handling
- If seeing rate limit errors, increase the delay between retries

---

## Backend Technical Notes

**Source**: `apps/backend/convowithmax.md`

### Important Context

- The solidity auctionhouse contract generates the `CreateListing` event from a Solidity library, not from within its own contract
- This means the `CreateListing` event isn't included in the contract ABI
- The indexer must track library events by signature rather than ABI
- Events are already on-chain and broadcasting - the indexer just needs to catch them

### Architecture Considerations

- The indexer is designed to be fault-tolerant and resume from the last processed block
- All configuration is in `config.js`
- Environment variables are loaded from `.env`
- Should store events in a database for faster client-side retrieval

---

# Cryptoart Studio App

## Cryptoart Studio App Overview

**Source**: `apps/cryptoart-studio-app/README.md`

A Farcaster Mini App built with Next.js + TypeScript + React for the cryptoart platform. This is the main frontend application for managing subscriptions, airdrops, and channel data.

### Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **UI**: React 18, Tailwind CSS
- **Blockchain**: Wagmi, Viem
- **Farcaster**: @farcaster/miniapp-sdk, @neynar/nodejs-sdk
- **Auth**: NextAuth, Neynar Auth

### Getting Started

```bash
npm run dev
```

### Deployment

```bash
npm run deploy:vercel
```

---

## Cryptoart Studio App Development

### Scripts

- `dev`: Start development server
- `build`: Build for production
- `start`: Start production server
- `lint`: Run ESLint
- `deploy:vercel`: Deploy to Vercel

### Environment Variables

The app requires various environment variables for:
- Farcaster authentication
- Neynar API keys
- Blockchain RPC endpoints
- NextAuth configuration
- Database connection (PostgreSQL)

---

## Cross-References

For detailed documentation, see the original source files:

- **Creator Core**: `packages/creator-core-contracts/README.md`, `ARCHITECTURE.md`, `DEPLOYMENT_GUIDE.md`, `QUICK_REFERENCE.md`
- **Auctionhouse Contracts**: `packages/auctionhouse-contracts/README.md`
- **Backend**: `apps/backend/guide.md`, `config.js`, `index.js`
- **Cryptoart Studio App**: `apps/cryptoart-studio-app/README.md`

For information about additional packages (cache, db, eslint-config, typescript-config, ui), see `PACKAGES.md`.

