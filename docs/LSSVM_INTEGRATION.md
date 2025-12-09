# LSSVM Integration Guide

This guide documents the integration of LSSVM (Liquidity-Sensitive Single-Variant Market) pools with the cryptoart-studio monorepo.

## Overview

Creators can now deploy their NFT collections and choose how to sell them:

1. **NFT Trade Pool (LSSVM)** - Enables royalties, pool fees, and allows reselling at current price
2. **Auction** - Traditional auction with reserve price
3. **Gallery Listing** - Fixed price listing, no reserve

These are separate flows - creators can have items in pools and auctions independently.

## Architecture

### Shared ABI Package (`@lssvm/abis`)

The LSSVM ABIs, addresses, and types are packaged in `@lssvm/abis` (located in the `such-lssvm` repository). This package is imported as a workspace dependency.

**Location:** `github.com/mxjxn/such-lssvm/packages/lssvm-abis`

**Exports:**
- ABIs: `LSSVM_PAIR_ABI`, `LSSVM_FACTORY_ABI`, `LSSVM_ROUTER_ABI`, `ERC721_ABI`, `ERC1155_ABI`, `ERC20_ABI`
- Address helpers: `getRouterAddress()`, `getFactoryAddress()`, `getBondingCurveAddress()`
- Types: `PoolType`, `CurveError`, `PoolData`, `BuyNFTQuote`, `SellNFTQuote`

### Querying Sales Data

LSSVM pools and auctionhouse listings are queried directly via their respective subgraphs:

- **LSSVM Pools**: Query the LSSVM subgraph (see Subgraph Endpoints below)
- **Auctionhouse Listings**: Query the Auctionhouse subgraph (see Subgraph Endpoints below)

The MVP app queries both subgraphs directly to display sales data for collections.

## Usage

### Adding LSSVM Pool Creation to Collection Flow

1. Import the sales method selector:
```typescript
import { SalesMethodSelector, type SalesMethod } from '@/components/studio/SalesMethodSelector'
```

2. Add the selector to your collection deployment modal:
```typescript
const [salesMethod, setSalesMethod] = useState<SalesMethod | null>(null)

<SalesMethodSelector
  value={salesMethod}
  onChange={setSalesMethod}
/>
```

3. Show the appropriate form based on selection:
```typescript
{salesMethod === 'pool' && (
  <CreatePoolForm
    chainId={chainId}
    nftContract={deployedContractAddress}
    nftType="ERC721"
    onSuccess={(poolAddress) => console.log('Pool created:', poolAddress)}
    onError={(error) => console.error('Error:', error)}
  />
)}
{salesMethod === 'auction' && (
  <CreateAuctionForm
    chainId={chainId}
    nftContract={deployedContractAddress}
    tokenId="1"
    tokenSpec="ERC721"
    onSuccess={(listingId) => console.log('Auction created:', listingId)}
    onError={(error) => console.error('Error:', error)}
  />
)}
{salesMethod === 'gallery' && (
  <CreateGalleryListingForm
    chainId={chainId}
    nftContract={deployedContractAddress}
    tokenId="1"
    tokenSpec="ERC721"
    onSuccess={(listingId) => console.log('Listing created:', listingId)}
    onError={(error) => console.error('Error:', error)}
  />
)}
```

### Querying Sales Data for a Collection

Query LSSVM pools and auctionhouse listings directly via their subgraphs:

**LSSVM Pools:**
```typescript
import { request } from 'graphql-request'

const LSSVM_SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/5440/such-lssvm/0.0.1'

const query = `
  query GetPools($nft: String!) {
    pairs(where: { nft: $nft }) {
      id
      nft
      bondingCurve
      spotPrice
      delta
      # ... other fields
    }
  }
`

const pools = await request(LSSVM_SUBGRAPH_URL, query, { nft: nftContractAddress })
```

**Auctionhouse Listings:**
```typescript
const AUCTIONHOUSE_SUBGRAPH_URL = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL

const query = `
  query GetListings($nftContract: String!) {
    listings(where: { nftContract: $nftContract }) {
      id
      nftContract
      tokenId
      price
      # ... other fields
    }
  }
`

const listings = await request(AUCTIONHOUSE_SUBGRAPH_URL, query, { nftContract: nftContractAddress })
```

### Displaying Sales Data

Use the `CollectionSalesView` component:

```typescript
import { CollectionSalesView } from '@/components/studio/CollectionSalesView'

<CollectionSalesView
  collectionAddress={nftContractAddress}
  chainId={chainId}
  sales={sales}
  isLoading={isLoading}
  error={error}
/>
```

## Contract Addresses

### Base Mainnet (Chain ID: 8453)

- **LSSVM Router**: `0x4352c72114C4b9c4e1F8C96347F2165EECaDeb5C`
- **LSSVM Factory**: `0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e`
- **Bonding Curves**:
  - LINEAR: `0xe41352CB8D9af18231E05520751840559C2a548A`
  - EXPONENTIAL: `0x9506C0E5CEe9AD1dEe65B3539268D61CCB25aFB6`
  - XYK: `0xd0A2f4ae5E816ec09374c67F6532063B60dE037B`
  - GDA: `0x4f1627be4C72aEB9565D4c751550C4D262a96B51`

### Base Sepolia (Chain ID: 84532)

- **LSSVM Router**: `0x6C9e6BAc4255901EaD3447C07917967E9dBc32d3`
- **LSSVM Factory**: `0x372990Fd91CF61967325dD5270f50c4192bfb892`

## Subgraph Endpoints

### LSSVM Subgraph

- **Base Mainnet**: `https://api.studio.thegraph.com/query/5440/such-lssvm/0.0.1`
- **Base Sepolia**: `https://api.studio.thegraph.com/query/5440/such-lssvm-sepolia/0.0.1`

### Auctionhouse Subgraph

- **Base Mainnet**: Configured via `NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL` environment variable
- See `packages/auctionhouse-subgraph/README.md` for deployment details

## Components

### SalesMethodSelector

Radio button selector for choosing sales method:
- NFT Trade Pool
- Auction
- Gallery Listing

### CreatePoolForm

Form for creating LSSVM pools. Supports:
- ERC721 and ERC1155 NFTs
- ETH and ERC20 payment tokens
- Multiple bonding curves (Linear, Exponential, XYK, GDA)
- Configurable spot price, delta, and fees

### CreateAuctionForm

Form for creating auctionhouse auctions (placeholder - to be implemented).

### CreateGalleryListingForm

Form for creating fixed-price gallery listings (placeholder - to be implemented).

### CollectionSalesView

Component for displaying existing pools and auctions for a collection.

## API Routes

### GET `/api/collections/[address]/sales`

Query sales data for a collection.

**Query Parameters:**
- `chainId` (optional): Chain ID (default: 8453)
- `first` (optional): Number of results (default: 100)
- `skip` (optional): Number to skip (default: 0)

**Response:**
```json
{
  "pools": [...],
  "auctions": [...]
}
```

## Dependencies

- `@lssvm/abis` - Shared LSSVM ABIs and types (workspace dependency from such-lssvm repo)
- `viem` - Ethereum library
- `wagmi` - React hooks for Ethereum
- `graphql-request` - GraphQL client for querying subgraphs

## Notes

- Environment variables (`.env.local`) must be updated manually
- Contract addresses should be verified against deployment summaries
- Sales methods are separate flows - creators can create pools and auctions independently
- LSSVM pools and auctionhouse listings are queried separately via their respective subgraphs
- The MVP app combines results from both subgraphs for display

