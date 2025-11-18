# NFT Management Studio - Pages Outline

This document outlines all pages in the NFT Management Studio for planning and organization purposes.

## Overview

The NFT Management Studio is a web application for deploying NFT contracts, minting NFTs, and managing collections. It's built as a Next.js app with mobile-first design using the Farcaster MiniApp SDK.

---

## Main Pages

### 1. Studio Landing Page (`/studio`)

**Route**: `/studio/page.tsx`

**Purpose**: Main hub/landing page for the Creator Studio

**Features**:
- Welcome section with description
- Quick action cards linking to:
  - Deploy Contract (`/studio/contracts/new`)
  - Create NFT (`/studio/nfts/create`)
  - View Contracts (`/studio/contracts`)
  - View NFTs (`/studio/nfts`)

```my-notes
there is a lot of pointless redundancy between this and the dashboard page and neither of them are what we need. Let me clarify!

Lets delete the dashboard entirely. It is not needed. "studio" will be the dashboard in the same sense. Lets talk about it:
This studio dashboard needs to very effectively display information. The flows such as "deploy contract" "create nft" need to be carefully planned out before beginnign development. the current components are getting it wrong. 

Heres what the studio page should have:
- 'current auctions' component. It can view as either a table or cards. In the cards view (default), it should put active auctions (countdown started) first. the tables should have columns thumbnail(xxs), title, reserve, current bid, bids #, started (date|null), ending (date|null), edit, link to auctionhouse page
- 'collections' component. This is also card / table. It shows all your collections, both ones deployed through this app and other ones imported. This view's header should have a + button for new collection which creates a modal like this...
[<] 
create a new collection 
dropdown > [erc721] [erc1155] [erc6551]
[infobox about selected token type]
[continue] [cancel]

the next screen will be a page dedicated to setting the collection details including name, description, image, and other standard metadata fields. No NFTs are made on this page. No marketplaces are chosen on this page.
```

**Components Used**:
- `MobileLayout`
- `AuthWrapper`

**Status**: ✅ Implemented

---

### 2. Dashboard Page (`/dashboard`)

**Route**: `/dashboard/page.tsx`

**Purpose**: Alternative entry point for NFT Management Studio

**Features**:
- Welcome section with "NFT Management Studio" title
- Contract deployment section (embedded `ContractDeployer` component)
- Similar to studio landing but with contract deployment directly on the page

**Components Used**:
- `MobileLayout`
- `AuthWrapper`
- `ContractDeployer`

**Status**: ✅ Implemented

**Note**: This appears to be a duplicate/alternative entry point. Consider consolidating with `/studio` or clarifying the difference.

---

## Contract Management Pages

### 3. View Contracts (`/studio/contracts`)

**Route**: `/studio/contracts/page.tsx`

**Purpose**: Display all deployed contracts for the authenticated user

**Features**:
- Lists all contracts from database
- Shows for each contract:
  - Collection name (or "Unnamed Collection")
  - Contract type (ERC721, ERC1155, ERC6551)
  - Symbol
  - Contract address
  - Chain ID
  - contract default image (is this a standard contract detail?)
  - Link to Basescan explorer
- "Deploy New" button in header
- Empty state with call-to-action if no contracts exist
- Loading and error states

```my-notes
The details above should be quite compact, not a lot of padding. The default image should be shown. below contract details, there should be an NFT grid/list. Each item has image, name, tokenid, description, owner(you, otherOwnerAddressOrENS, "on auction", "for sale", "in pool"). Clicking the line item or card opens its nft page. 
```
**API Endpoint**: `GET /api/studio/contracts`

**Components Used**:
- `MobileLayout`
- `AuthWrapper`

**Status**: ✅ Implemented

---

### 4. Deploy New Contract (`/studio/contracts/new`)

**Route**: `/studio/contracts/new/page.tsx`

**Purpose**: Deploy a new NFT contract (ERC721, ERC1155, or ERC6551)

**Features**:
- Contract type selection (ERC721, ERC1155, ERC6551)
- Contract name input
- Symbol input (auto-uppercase, max 10 chars)
- Sales method selector (both, auction, fixed-price)
- Upgradeable toggle (currently not fully implemented)
- Chain ID detection and warning (testnet vs mainnet)
- Wallet connection requirement
- Deployment status and success state
- Link to view on Basescan after deployment
- Link to view all contracts

**Components Used**:
- `MobileLayout`
- `AuthWrapper`
- `ContractDeployer` (main component with all logic)

**API Endpoints**:
- `GET /api/studio/deploy?type={contractType}&upgradeable={isUpgradeable}` - Get contract bytecode/ABI
- `POST /api/studio/contracts` - Save deployed contract to database

**Status**: ✅ Partially Implemented
- ✅ ERC721 and ERC1155 deployment
- ⚠️ ERC6551 deployment not implemented
- ⚠️ Upgradeable deployment not implemented (shows error)

---

## NFT Management Pages

### 5. View NFTs (`/studio/nfts`)

**Route**: `/studio/nfts/page.tsx`

**Purpose**: Display all minted NFTs for the authenticated user

**Features**:
- Lists all mints from database
- Shows for each NFT:
  - Token ID
  - Recipient address
  - Metadata URI link (if available)
  - Transaction hash link to Basescan (if available)
  - External link to token on Basescan (if collection ID exists)
- "Create NFT" button in header
- Empty state with call-to-action if no NFTs exist
- Loading and error states

**API Endpoint**: `GET /api/studio/nfts`

**Components Used**:
- `MobileLayout`
- `AuthWrapper`

**Status**: ✅ Implemented

---

### 6. Create NFT (`/studio/nfts/create`)

**Route**: `/studio/nfts/create/page.tsx`

**Purpose**: Create/mint new NFTs with different minting types

**Features**:
- Mint type selector:
  - **1/1**: Single unique NFT
  - **Series**: Multiple NFTs from ZIP upload
  - **Edition**: Limited or open edition (multiple copies)
- Wallet connection requirement
- Success state after minting

**Components Used**:
- `MobileLayout`
- `AuthWrapper`
- `NFTMinter` (main component with all logic)

**Status**: ✅ Partially Implemented

#### 6a. 1/1 Minting (within Create NFT page)

**Component**: `NFTMinter` - 1/1 section

**Features**:
- Contract address input
- Image upload (file picker)
- Metadata URI input (IPFS)
- Mint button
- Transaction status (pending, confirming, success)
- Error handling

**Status**: ⚠️ Partially Implemented
- UI is complete
- Actual minting logic is TODO (placeholder)

**Needs Implementation**:
- Image upload to IPFS
- Metadata JSON creation
- Metadata upload to IPFS
- Contract mint function call
- Database save via API

---

#### 6b. Series Minting (within Create NFT page)

**Component**: `SeriesUploader`

**Features**:
- Contract address input
- ZIP file upload
- Process series button
- Success state
- Error handling

**Status**: ⚠️ Partially Implemented
- UI is complete
- ZIP processing logic is TODO (placeholder)

**Needs Implementation**:
- ZIP file extraction
- Metadata.json parsing
- Image/animation/thumbnail extraction
- Asset upload to IPFS
- Metadata JSON creation for each NFT
- Metadata upload to IPFS
- Batch minting
- Database save via API

---

#### 6c. Edition Minting (within Create NFT page)

**Component**: `EditionCreator`

**Features**:
- Contract address input
- Edition type selector (limited/open)
- Max supply input (for limited editions)
- Price input
- Start time input
- End time input
- Metadata URI input
- Create edition button
- Transaction status
- Success state
- Error handling

**Status**: ⚠️ Partially Implemented
- UI is complete
- Edition creation logic is TODO (placeholder)

**Needs Implementation**:
- Image/metadata upload to IPFS
- Contract edition creation function call
- Mint timeframe configuration
- Price setting
- Database save via API

**Note**: Editions use ERC1155 contracts (not ERC721)

---

## API Routes

### Studio API Endpoints

- `GET /api/studio/contracts` - Fetch all contracts for user
- `POST /api/studio/contracts` - Save new contract to database
- `GET /api/studio/deploy` - Get contract bytecode/ABI for deployment
- `GET /api/studio/nfts` - Fetch all NFTs/mints for user
- `POST /api/studio/nfts` - Save new mint to database
- `POST /api/studio/upload` - Upload files to IPFS (if implemented)

---

## Component Architecture

### Studio Components (`src/components/studio/`)

1. **ContractDeployer.tsx**
   - Handles contract deployment logic
   - Contract type selection
   - Form inputs (name, symbol, upgradeable, sales method)
   - Deployment transaction handling
   - Success/error states

2. **NFTMinter.tsx**
   - Main container for NFT creation
   - Mint type selector (1/1, series, edition)
   - Renders appropriate sub-component based on type
   - 1/1 minting form

3. **SeriesUploader.tsx**
   - ZIP file upload
   - Series processing (placeholder)

4. **EditionCreator.tsx**
   - Edition creation form
   - Limited/open edition options
   - Price and timeframe configuration

5. **SalesMethodSelector.tsx**
   - Sales method selection component
   - Used in ContractDeployer

---

## Data Models

### Contract
- `id`: string
- `address`: string
- `name`: string | null
- `symbol`: string | null
- `contractType`: string (ERC721, ERC1155, ERC6551)
- `chainId`: number
- `createdAt`: string
- `metadata`: object (includes salesMethod, isUpgradeable)

### Mint
- `id`: string
- `collectionId`: number | null
- `tokenId`: string
- `recipientAddress`: string
- `recipientFid`: number | null
- `txHash`: string | null
- `metadata`: any
- `createdAt`: string

---

## Current Issues & TODOs

### High Priority
1. **1/1 Minting**: Implement actual minting logic (IPFS upload, contract call, DB save)
2. **Series Upload**: Implement ZIP processing and batch minting
3. **Edition Creation**: Implement edition creation logic
4. **Upgradeable Contracts**: Implement proxy deployment pattern
5. **ERC6551 Support**: Implement ERC6551 contract deployment

### Medium Priority
1. **Error Handling**: Improve error messages and user feedback
2. **Loading States**: Better loading indicators during transactions
3. **Transaction Tracking**: Better tracking of pending transactions
4. **IPFS Integration**: Proper IPFS upload service integration

### Low Priority / UX Improvements
1. **Page Consolidation**: Consider consolidating `/dashboard` and `/studio` or clarify purpose
2. **Navigation**: Add breadcrumbs or better navigation between pages
3. **Contract Details**: Add detail pages for individual contracts
4. **NFT Details**: Add detail pages for individual NFTs
5. **Filtering/Search**: Add filtering and search to contracts and NFTs lists
6. **Pagination**: Add pagination for large lists

---

## Navigation Flow

```
/studio (Landing)
├── /studio/contracts/new (Deploy Contract)
│   └── /studio/contracts (View Contracts)
├── /studio/nfts/create (Create NFT)
│   ├── 1/1 Minting
│   ├── Series Upload
│   └── Edition Creation
└── /studio/nfts (View NFTs)

/dashboard (Alternative Entry)
└── Contract Deployment (embedded)
```

---

## Notes for Planning

- The studio is well-structured but many core features are placeholders
- Focus on implementing the TODO items in NFTMinter, SeriesUploader, and EditionCreator
- Consider adding detail pages for contracts and NFTs
- The `/dashboard` page seems redundant with `/studio` - consider consolidation
- All pages use mobile-first design with `MobileLayout`
- Authentication is handled via `AuthWrapper` on all pages
- Farcaster MiniApp SDK integration is present on all pages

---

*Last Updated: [Current Date]*
*This document should be updated as features are implemented and new pages are added.*

