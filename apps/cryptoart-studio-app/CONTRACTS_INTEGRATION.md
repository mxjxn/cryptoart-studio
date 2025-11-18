# Contracts Integration Guide

## TL;DR - What is the Studio App?

**The CryptoArt Studio App is a web interface (Farcaster Mini App) that lets creators:**
- Deploy NFT contracts (using the Creator Core contracts we documented)
- Mint NFTs to those contracts
- Manage their collections
- Create listings and auctions

**Think of it like this:**
- **Contracts** = The smart contracts on the blockchain (the "engine")
- **Studio App** = The user-friendly website that talks to those contracts (the "dashboard")

## How They Work Together

```
┌─────────────────────────────────────────────────────────┐
│  Studio App (Web Interface)                            │
│  - User clicks "Deploy Contract"                        │
│  - User fills in name, symbol, type                    │
│  - User connects wallet                                 │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Calls contract functions via Wagmi
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Creator Core Contracts (On Blockchain)                │
│  - ERC721CreatorImplementation                          │
│  - ERC1155CreatorImplementation                        │
│  - Proxy pattern for upgradeability                     │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Stores on blockchain
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Base Network (Blockchain)                              │
│  - Contract deployed at address 0x...                  │
│  - NFTs minted and owned by users                      │
│  - All transactions recorded                            │
└─────────────────────────────────────────────────────────┘
```

## Key Files and What They Do

### 1. Contract Deployment

**File**: `src/components/studio/ContractDeployer.tsx`

**What it does:**
- Shows a form to deploy new NFT contracts
- User selects: ERC721, ERC1155, or ERC6551
- User enters: name, symbol, upgradeable option
- **Currently TODO**: Needs to actually call the contract deployment

**How it relates to contracts:**
- This would deploy `ERC721CreatorImplementation` or `ERC1155CreatorImplementation`
- Uses the proxy pattern if "upgradeable" is checked
- Saves the deployed address to the database

**Connection:**
```typescript
// When user clicks "Deploy Contract"
// Studio App would call:
const proxy = await deployERC721Creator({
  name: "My Collection",
  symbol: "MC",
  upgradeable: true  // Uses TransparentUpgradeableProxy
});

// This creates the same 3-part system we documented:
// - Proxy (user-facing address)
// - Implementation (logic)
// - ProxyAdmin (upgrade control)
```

### 2. NFT Minting

**File**: `src/components/studio/NFTMinter.tsx`

**What it does:**
- Lets creators mint NFTs to their deployed contracts
- Supports 3 types: 1/1, series, or edition
- Handles image upload and metadata URI
- **Currently TODO**: Needs actual minting implementation

**How it relates to contracts:**
- Calls `mintBase()` or `mintBaseBatch()` on the deployed contract
- For series: Uses `mintBaseBatch()` to mint multiple tokens
- For editions: Would use ERC1155 `mintBaseNew()` for multiple copies

**Connection:**
```typescript
// When user mints a 1/1 NFT:
// Studio App would call:
const tokenId = await contract.mintBase(
  userAddress,
  "ipfs://QmHash..." // metadata URI
);

// This uses the mintBase function from ERC721CreatorImplementation
// which we documented in ARCHITECTURE.md
```

### 3. Contract Management

**File**: `src/app/api/studio/contracts/route.ts`

**What it does:**
- API endpoint to save/retrieve deployed contracts
- Stores contract info in database (address, name, symbol, type)
- Links contracts to creators (via Farcaster ID)

**How it relates to contracts:**
- After deployment, saves the contract address
- Tracks which contracts belong to which creator
- Used to list all contracts a creator has deployed

**Connection:**
```typescript
// After contract is deployed:
POST /api/studio/contracts
{
  address: "0x6302C5F1F2E3d0e4D5ae5aeB88bd8044c88Eef9A", // Proxy address
  name: "Radical Testers",
  symbol: "RT",
  contractType: "ERC721",
  chainId: 84532, // Base Sepolia
  deployTxHash: "0x..."
}

// This saves the contract info so creators can see their collections
```

### 4. Series Upload

**File**: `src/components/studio/SeriesUploader.tsx`

**What it does:**
- Upload a ZIP file containing multiple NFT images/metadata
- Processes the ZIP and mints each as a separate NFT
- **Currently TODO**: Needs full implementation

**How it relates to contracts:**
- Would use `mintBaseBatch()` to mint all NFTs in one transaction
- Each NFT gets its own token ID (1, 2, 3, ...)
- All NFTs belong to the same contract

**Connection:**
```typescript
// When user uploads series ZIP:
// 1. Extract images and metadata
// 2. Upload each to IPFS
// 3. Call contract:
const tokenIds = await contract.mintBaseBatch(
  userAddress,
  ["ipfs://hash1", "ipfs://hash2", "ipfs://hash3", ...]
);

// This uses the batch minting we documented
// Much more gas efficient than minting one-by-one
```

### 5. Edition Creator

**File**: `src/components/studio/EditionCreator.tsx`

**What it does:**
- Create limited or open editions (multiple copies of same NFT)
- Set max supply, price, mint timeframe
- **Currently TODO**: Needs implementation

**How it relates to contracts:**
- Would use ERC1155 contract (not ERC721)
- Uses `mintBaseNew()` or `mintBaseExisting()` for editions
- Can mint multiple copies of same token ID

**Connection:**
```typescript
// When creating an edition:
// Uses ERC1155Creator contract:
const tokenId = await contract.mintBaseNew(
  [userAddress],
  [100], // 100 copies
  ["ipfs://metadata"]
);

// This creates 100 copies of token ID 1
// vs ERC721 where each token is unique
```

## Data Flow Examples

### Example 1: Deploy and Mint

```
1. User opens Studio App
   └─> /studio/contracts/new

2. User fills form:
   - Name: "My Collection"
   - Symbol: "MC"
   - Type: ERC721
   - Upgradeable: Yes

3. User clicks "Deploy"
   └─> ContractDeployer.tsx calls deployment function
       └─> Deploys ERC721CreatorImplementation
       └─> Deploys ProxyAdmin
       └─> Deploys TransparentUpgradeableProxy
       └─> Returns proxy address: 0x...

4. Studio App saves to database
   └─> POST /api/studio/contracts
       └─> Stores: address, name, symbol, type

5. User navigates to mint page
   └─> /studio/nfts/create

6. User selects contract and mints NFT
   └─> NFTMinter.tsx calls contract.mintBase()
       └─> NFT minted with token ID 1
       └─> Saved to database via POST /api/studio/nfts
```

### Example 2: Series Upload

```
1. User uploads ZIP file
   └─> SeriesUploader.tsx receives file

2. Studio App processes ZIP:
   - Extracts images
   - Extracts metadata.json
   - Uploads each image to IPFS
   - Creates metadata JSON for each
   - Uploads metadata to IPFS

3. Studio App mints batch:
   └─> contract.mintBaseBatch(userAddress, ipfsHashes)
       └─> Mints tokens 1-100 in single transaction
       └─> Much cheaper than 100 separate transactions

4. Studio App saves to database:
   └─> POST /api/studio/nfts (for each NFT)
       └─> Stores: contractAddress, tokenId, metadataURI
```

## Current Status

### ✅ What's Working
- UI components for deployment and minting
- Database schema for storing contracts/NFTs
- API endpoints for saving contract/NFT data
- Wallet connection (Wagmi)
- Farcaster authentication

### 🚧 What's TODO
- **ContractDeployer**: Actual contract deployment logic
- **NFTMinter**: Actual minting calls to contracts
- **SeriesUploader**: ZIP processing and batch minting
- **EditionCreator**: Edition creation logic
- **IPFS Upload**: Image and metadata upload to IPFS

## Integration Points

### 1. Contract ABIs

The studio app needs the contract ABIs to interact with deployed contracts:

```typescript
// Would import from creator-core-contracts package:
import { ERC721CreatorImplementationABI } from '@cryptoart/creator-core-contracts';

// Or fetch from deployed contract:
const abi = await fetchABI(contractAddress);
```

### 2. Deployment Scripts

The studio app could use the deployment scripts from `creator-core-contracts`:

```typescript
// Could import and use:
import { DeployAndMintCollection } from '@cryptoart/creator-core-contracts/scripts';

// Or implement similar logic in TypeScript
```

### 3. Contract Addresses

After deployment, the studio app stores:
- **Proxy Address**: What users interact with (0x6302...)
- **Implementation Address**: The logic contract (0x0C1f...)
- **ProxyAdmin Address**: Upgrade control (0xDF6c...)

Only the proxy address is needed for normal operations.

## Key Concepts

### Proxy Pattern in Studio App

When a user deploys an upgradeable contract:
1. Studio App deploys implementation (one-time, expensive)
2. Studio App deploys ProxyAdmin
3. Studio App deploys proxy (cheap, per collection)
4. Studio App stores proxy address (this is what users see)

**Why this matters:**
- Users only need to know the proxy address
- The proxy address never changes (even if upgraded)
- Studio App can upgrade contracts later via ProxyAdmin

### Minting Types

**1/1 (One-of-One):**
- Each NFT is unique
- Uses `mintBase()` - one token at a time
- Each gets sequential token ID (1, 2, 3, ...)

**Series:**
- Multiple unique NFTs in one collection
- Uses `mintBaseBatch()` - all at once
- More gas efficient than individual mints

**Edition:**
- Multiple copies of same NFT
- Uses ERC1155 `mintBaseNew()`
- Same token ID, different quantities

### Sales Methods

The studio app tracks how NFTs can be sold:
- **Auction**: Via auctionhouse contracts
- **Fixed Price**: Direct sale
- **Both**: Supports both methods

This is stored in the database but doesn't affect the core contract.

## Related Documentation

- **[Creator Core Contracts Architecture](../../packages/creator-core-contracts/ARCHITECTURE.md)**: How the contracts work internally
- **[Deployment Guide](../../packages/creator-core-contracts/DEPLOYMENT_GUIDE.md)**: How to deploy contracts manually
- **[Studio App Developer Guide](./DEVELOPER_GUIDE.md)**: General studio app development

## Next Steps for Implementation

1. **Add Contract ABIs**: Import or fetch ABIs for deployed contracts
2. **Implement Deployment**: Use Foundry scripts or TypeScript deployment
3. **Implement Minting**: Call `mintBase()` and `mintBaseBatch()` functions
4. **Add IPFS Upload**: Integrate with IPFS service (Pinata, NFT.Storage, etc.)
5. **Add Error Handling**: Handle contract errors gracefully
6. **Add Transaction Tracking**: Show pending transactions and confirmations

## Summary

The Studio App is the **user interface** for the Creator Core contracts. It:
- Makes contract deployment easy (no need to write scripts)
- Provides forms for minting NFTs
- Tracks deployed contracts and minted NFTs
- Connects Farcaster users to their blockchain creations

The contracts are the **smart contract layer** that:
- Actually stores NFTs on-chain
- Handles ownership and transfers
- Supports extensions and royalties
- Uses proxy pattern for upgradeability

Together, they create a complete creator tool for deploying and managing NFT collections on Base network.

