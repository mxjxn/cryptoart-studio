# Cryptoart Studio Integration Tasklist

This document tracks tasks for integrating LSSVM pool functionality with the cryptoart-studio monorepo, enabling creators to choose between "sell via pool" (LSSVM) and "sell via auction" (Auctionhouse) when creating collections.

## 🔴 High Priority

### Cross-Repo Dependency Setup

- [ ] **Add `@lssvm/abis` dependency to cryptoart-monorepo**
  - [ ] Update `package.json` root to include:
    ```json
    {
      "dependencies": {
        "@lssvm/abis": "workspace:git+https://github.com/mxjxn/such-lssvm.git#main:packages/lssvm-abis"
      }
    }
    ```
  - [ ] Run `pnpm install` to fetch the package
  - [ ] Verify package resolves correctly
  - [ ] Test importing ABIs in a test file

### Environment Variables & Configuration

- [ ] **Verify marketplace contract address**
  - Current address: `0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9` (Base Mainnet)
  - Verify this is correct in `apps/auctionhouse/src/lib/contracts/marketplace.ts`
  - Verify in `apps/backend/config.js`
  - **Note**: Must be done manually as env vars are not accessible to AI tools

- [ ] **Add LSSVM contract addresses to config**
  - [ ] Add LSSVM Factory address: `0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e` (Base Mainnet)
  - [ ] Add LSSVM Router address: `0x4352c72114C4b9c4e1F8C96347F2165EECaDeb5C` (Base Mainnet)
  - [ ] Create config file or update existing config to include both marketplace and LSSVM addresses
  - [ ] Document addresses in README or config documentation

## 🟡 Cross-Repo Integration Tasks

### Phase 1: Create Contracts ABIs Package (Optional)

- [ ] **Create `packages/contracts-abis/` package** (if ABIs need to be shared)
  - [ ] Create `package.json` with proper exports
  - [ ] Extract Auctionhouse ABIs from:
    - `apps/backend/config.js` (marketplaceAbi events)
    - `packages/auctionhouse-contracts/` (full ABIs from compiled contracts)
  - [ ] Extract Creator Core ABIs from:
    - `packages/creator-core-contracts/` (ERC721/ERC1155 Creator ABIs)
  - [ ] Export contract addresses/configuration helpers
  - [ ] Add TypeScript build configuration
  - [ ] Update `pnpm-workspace.yaml` to include new package

- [ ] **Create `packages/contracts-abis/src/index.ts`**
  - Export all ABIs
  - Export address helpers
  - Export types

- [ ] **Create `packages/contracts-abis/src/auctionhouse.ts`**
  - Export Marketplace ABIs
  - Export Marketplace address
  - Export Marketplace types

- [ ] **Create `packages/contracts-abis/src/creator-core.ts`**
  - Export Creator Core ABIs (ERC721/ERC1155)
  - Export Creator Core addresses (if applicable)
  - Export Creator Core types

### Phase 2: Create Unified Indexer Package

- [ ] **Create `packages/unified-indexer/` package**
  - [ ] Create `package.json` with dependencies:
    - `@lssvm/abis` (from such-lssvm repo)
    - `@cryptoart/contracts-abis` (if created)
    - GraphQL client libraries
    - TypeScript types
  - [ ] Add TypeScript build configuration
  - [ ] Update `pnpm-workspace.yaml` to include new package

- [ ] **Create `packages/unified-indexer/src/index.ts`**
  - Export unified query functions
  - Export types (PoolData, AuctionData, SalesOptions)

- [ ] **Create `packages/unified-indexer/src/types.ts`**
  - Define `PoolData` interface (from LSSVM)
  - Define `AuctionData` interface (from Auctionhouse)
  - Define `SalesOptions` interface combining both
  - Define `SalesMethod` type: `"pool" | "auction" | "both"`

- [ ] **Create `packages/unified-indexer/src/lssvm-queries.ts`**
  - GraphQL queries for LSSVM subgraph
  - `queryPoolsByNFTContract(nftContract: string, chainId: number)`
  - `queryPoolDetails(poolAddress: string)`
  - Use LSSVM subgraph endpoint:
    - Base Mainnet: `https://api.studio.thegraph.com/query/5440/such-lssvm/0.0.1`

- [ ] **Create `packages/unified-indexer/src/auctionhouse-queries.ts`**
  - GraphQL queries for Auctionhouse subgraph
  - `queryListingsByNFTContract(nftContract: string, chainId: number)`
  - `queryListingDetails(listingId: string)`
  - Use Auctionhouse subgraph endpoint (to be determined)

- [ ] **Create `packages/unified-indexer/src/unified.ts`**
  - `getSalesOptions(nftContract: string, chainId: number): Promise<SalesOptions>`
    - Queries both LSSVM and Auctionhouse subgraphs
    - Returns unified data structure with pools and auctions
  - `getPoolData(poolAddress: string): Promise<PoolData>`
  - `getAuctionData(listingId: string): Promise<AuctionData>`

- [ ] **Build and test the package**
  - [ ] Run `pnpm build` to ensure TypeScript compiles
  - [ ] Test queries against deployed subgraphs
  - [ ] Verify error handling for missing data

### Phase 3: UI Integration - Collection Creation

- [ ] **Update `apps/cryptoart-studio-app/src/components/studio/ContractDeployer.tsx`**
  - [ ] Add sales method selection UI
  - [ ] Import `SalesMethod` type from `@cryptoart/unified-indexer`
  - [ ] Add state for sales method: `useState<SalesMethod>("both")`
  - [ ] Add radio buttons or toggle for: "Pool", "Auction", "Both"
  - [ ] Update form to include sales method in deployment data

- [ ] **Create `apps/cryptoart-studio-app/src/components/studio/SalesMethodSelector.tsx`**
  - [ ] Create reusable component for sales method selection
  - [ ] Props: `value: SalesMethod`, `onChange: (method: SalesMethod) => void`
  - [ ] UI: Radio buttons or segmented control
  - [ ] Include descriptions: "Sell via Pool (LSSVM)", "Sell via Auction", "Both"
  - [ ] Add icons or visual indicators

- [ ] **Update collection creation flow**
  - [ ] Integrate `SalesMethodSelector` into collection creation form
  - [ ] Store sales method preference with collection metadata
  - [ ] Pass sales method to API when saving collection

- [ ] **Create pool creation flow**
  - [ ] Create `apps/cryptoart-studio-app/src/components/studio/CreatePoolForm.tsx`
  - [ ] Import LSSVM ABIs from `@lssvm/abis`
  - [ ] Use `LSSVM_FACTORY_ABI` for pool creation
  - [ ] Implement pool creation transaction:
    - Select NFT contract (from Creator Core)
    - Select bonding curve type
    - Set initial spot price
    - Set delta
    - Set fee
  - [ ] Use wagmi hooks for transaction handling
  - [ ] Show transaction status and confirmation

- [ ] **Create auction listing flow**
  - [ ] Create `apps/cryptoart-studio-app/src/components/studio/CreateListingForm.tsx`
  - [ ] Import Auctionhouse ABIs (from `@cryptoart/contracts-abis` or local)
  - [ ] Use Marketplace ABI for listing creation
  - [ ] Implement listing creation transaction:
    - Select NFT contract and token ID(s)
    - Set listing type (fixed price, auction, etc.)
    - Set initial price/amount
    - Set start/end times
  - [ ] Use wagmi hooks for transaction handling
  - [ ] Show transaction status and confirmation

### Phase 4: UI Integration - Sales Display

- [ ] **Create unified sales view component**
  - [ ] Create `apps/cryptoart-studio-app/src/components/studio/CollectionSalesView.tsx`
  - [ ] Use `@cryptoart/unified-indexer` to fetch sales data
  - [ ] Display pools and auctions in separate sections or tabs
  - [ ] Show clear distinction between pool and auction sales
  - [ ] Include "Create Pool" and "Create Listing" buttons

- [ ] **Update collection detail page**
  - [ ] Add sales view to collection detail page
  - [ ] Show active pools and auctions for the collection
  - [ ] Allow filtering by sales method

- [ ] **Create pool details component**
  - [ ] Create `apps/cryptoart-studio-app/src/components/studio/PoolDetails.tsx`
  - [ ] Display pool information:
    - Spot price
    - Delta
    - Fee
    - Available NFTs
    - Pool type (ERC721/ERC1155)
  - [ ] Import types from `@lssvm/abis`

- [ ] **Create auction details component**
  - [ ] Create `apps/cryptoart-studio-app/src/components/studio/AuctionDetails.tsx`
  - [ ] Display auction information:
    - Listing ID
    - Current price/bid
    - Time remaining
    - Available quantity
  - [ ] Import types from Auctionhouse ABIs

### Phase 5: API Routes

- [ ] **Create unified sales API route**
  - [ ] Create `apps/cryptoart-studio-app/src/app/api/collections/[address]/sales/route.ts`
  - [ ] Use `@cryptoart/unified-indexer` to query both subgraphs
  - [ ] Return JSON with structure:
    ```typescript
    {
      pools: PoolData[],
      auctions: AuctionData[],
      collectionAddress: string
    }
    ```
  - [ ] Handle errors gracefully
  - [ ] Add caching if needed

- [ ] **Create pool-specific API route** (optional)
  - [ ] Create `apps/cryptoart-studio-app/src/app/api/pools/[poolAddress]/route.ts`
  - [ ] Query LSSVM subgraph for pool details
  - [ ] Return pool data

- [ ] **Create auction-specific API route** (optional)
  - [ ] Create `apps/cryptoart-studio-app/src/app/api/listings/[listingId]/route.ts`
  - [ ] Query Auctionhouse subgraph for listing details
  - [ ] Return listing data

- [ ] **Update collection API routes**
  - [ ] Update `apps/cryptoart-studio-app/src/app/api/studio/contracts/route.ts`
  - [ ] Include sales method in collection data
  - [ ] Store sales method preference when creating collection

### Phase 6: Subgraph/Indexer Integration

- [ ] **Verify Auctionhouse subgraph deployment**
  - [ ] Confirm subgraph is deployed and accessible
  - [ ] Document subgraph endpoint
  - [ ] Verify it supports querying by NFT contract address
  - [ ] Test queries for listings by contract

- [ ] **Update subgraph queries** (if needed)
  - [ ] Ensure Auctionhouse subgraph supports:
    - Querying listings by NFT contract address
    - Querying active listings
    - Querying listing details
  - [ ] Add any missing fields needed for unified display

- [ ] **Create subgraph documentation**
  - [ ] Document both subgraph endpoints
  - [ ] Document query examples
  - [ ] Document data structures

- [ ] **Test unified queries**
  - [ ] Test `getSalesOptions` with real contract addresses
  - [ ] Verify both pools and auctions are returned correctly
  - [ ] Test error handling for contracts with no sales

## 🟢 Documentation & Maintenance

- [ ] **Update README.md**
  - [ ] Document cross-repo integration approach
  - [ ] Add instructions for using `@lssvm/abis` package
  - [ ] Document unified indexer usage
  - [ ] Add LSSVM contract addresses to contract addresses section

- [ ] **Create integration guide**
  - [ ] Document how to add LSSVM pool creation to collection flow
  - [ ] Document how to query both sales methods
  - [ ] Add code examples for using unified indexer
  - [ ] Document sales method selection flow

- [ ] **Update `llms-full.md`**
  - [ ] Add section on LSSVM integration
  - [ ] Document unified indexer package
  - [ ] Document sales method selection

- [ ] **Update component documentation**
  - [ ] Document `SalesMethodSelector` component
  - [ ] Document `CreatePoolForm` component
  - [ ] Document `CreateListingForm` component
  - [ ] Document `CollectionSalesView` component

## 📝 Notes

- **Env Vars**: Environment variables must be updated manually as they are not accessible to AI tools
- **Contract Addresses**:
  - Marketplace (Auctionhouse): `0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9` (Base Mainnet)
  - LSSVM Factory: `0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e` (Base Mainnet)
  - LSSVM Router: `0x4352c72114C4b9c4e1F8C96347F2165EECaDeb5C` (Base Mainnet)
- **Subgraph Endpoints**:
  - LSSVM Base Mainnet: `https://api.studio.thegraph.com/query/5440/such-lssvm/0.0.1`
  - Auctionhouse: (to be determined)
- **Dependencies**: The `@lssvm/abis` package must be created in the such-lssvm repo first before it can be used here

## 🔗 Related Repositories

- **cryptoart-studio**: `github.com/mxjxn/cryptoart-studio` (this repo)
- **such-lssvm**: `github.com/mxjxn/such-lssvm` (LSSVM contracts and ABIs)

## Dependencies on such-lssvm Repo

This integration depends on the following tasks being completed in the such-lssvm repo:

1. ✅ `packages/lssvm-abis/` package must be created and published/accessible
2. ✅ LSSVM subgraph must be deployed and accessible
3. ✅ Contract addresses must be verified and documented

See `TASKLIST.md` in the such-lssvm repo for progress on these tasks.

---

**Last Updated**: 2025-01-XX
**Status**: Planning phase - awaiting completion of such-lssvm ABI package creation

