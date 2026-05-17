# such.gallery — ERC-6551 NFT Gallery Contracts

**such.gallery** is a thin ERC-721 + ERC-6551 escrow layer. Each NFT is a gallery whose token-bound account holds deposited art. Transfer the gallery NFT — transfer all contents in one transaction. Gallery layout and art positioning are derived **off-chain** by a deterministic renderer; the contract stores *which* NFTs are deposited, not *where* they hang.

Season 1: 30 galleries, one per day, Dutch auction mint.

## Overview

| Concern | Where it lives |
|---|---|
| **Gallery NFT minting** | `SuchGallery.sol` — ERC-721 with Dutch auction |
| **Art custody** | ERC-6551 token-bound account per gallery NFT |
| **Gallery traits** | On-chain `GalleryTraits` struct (procedural seeds: `wallHue`, `floorMaterial`, `lighting`, `trimStyle`) |
| **Deposit tracking** | On-chain `depositedCollections` mapping per gallery |
| **3D layout / art placement** | **Off-chain renderer** — pure function of `(tokenId seed, depositedTokens[])` |

The renderer is a pure function: given a token ID (which determines gallery traits) and the list of deposited tokens, it produces a deterministic 3D gallery layout. No manual positioning is required — the arrangement emerges from on-chain state.

## Architecture

```
┌─────────────────────────────────────────────┐
│               SuchGallery.sol               │
│  ERC-721 / ERC-721Enumerable / ERC-2981     │
│                                             │
│  • Dutch auction mint (30 tokens, 1/day)    │
│  • GalleryTraits { wallHue, floorMaterial,  │
│    lighting, trimStyle } — deterministic    │
│    from tokenId seed                        │
│  • Deposit/withdrawal registry              │
│  • tokenURI → on-chain base64 JSON          │
│    with trait attributes + preview image URL│
└──────────────┬──────────────────────────────┘
               │ each token gets one via ERC-6551 registry
        ┌──────┴──────┐
        │  Token-Bound │
        │   Account    │  ← holds deposited NFTs
        │  (ERC-6551)  │
        └──────────────┘

┌─────────────────────────────────────────────┐
│          Off-Chain Renderer (not in repo)    │
│                                             │
│  f(tokenId, GalleryTraits, depositedTokens[])│
│           → 3D gallery layout               │
│                                             │
│  No on-chain placement data. Layout is      │
│  derived purely from on-chain state.        │
└─────────────────────────────────────────────┘
```

### Key design decisions

- **No on-chain art placement.** The contract tracks which collections are deposited; the renderer decides how they appear.
- **Procedural traits.** `GalleryTraits` are generated deterministically from `tokenId` at mint time — no randomness oracle needed.
- **Deposit registration is opt-in indexing.** `registerDeposit` / `registerWithdrawal` maintain an on-chain index for easy querying, but custody is handled by the ERC-6551 account itself.
- **Transfer = full bundle.** Transferring the gallery NFT transfers the ERC-6551 account and all its contents.

## Contract API

### Auction

| Function | Description |
|---|---|
| `startAuction()` | Owner starts next daily auction |
| `mint()` payable | Mint next gallery NFT at current Dutch auction price |
| `getCurrentPrice()` view | Returns current price based on time decay |

### Traits

| Function | Description |
|---|---|
| `traits(uint256 tokenId)` view | Returns `GalleryTraits { wallHue, floorMaterial, lighting, trimStyle }` |

### Deposit / Withdrawal

| Function | Description |
|---|---|
| `registerDeposit(uint256 galleryTokenId, address collection, uint256 artTokenId)` | Record an NFT deposited into the gallery's 6551 account |
| `registerWithdrawal(uint256 galleryTokenId, address collection, uint256 artTokenId)` | Record an NFT withdrawn from the 6551 account |
| `getDepositedCollections(uint256 galleryTokenId)` view | Returns array of deposited collection addresses |
| `isDepositedCollection(uint256 galleryTokenId, address collection)` view | Whether a collection is deposited in a gallery |

### ERC-6551

| Function | Description |
|---|---|
| `getTokenBoundAccount(uint256 tokenId)` view | Computed 6551 account address for a gallery NFT |

### Admin

| Function | Description |
|---|---|
| `configureAuction(uint256 startPrice, uint256 reservePrice, uint256 decayRate)` | Update auction parameters |
| `withdraw()` | Owner sweeps contract balance |

### Events

| Event | When |
|---|---|
| `GalleryMinted(tokenId, owner, price)` | On successful mint |
| `ArtDeposited(galleryTokenId, collection, tokenId)` | On deposit registration |
| `ArtWithdrawn(galleryTokenId, collection, tokenId)` | On withdrawal registration |
| `AuctionConfigured(startPrice, reservePrice, decayRate)` | On auction param update |

## Season 1 Parameters

- **Supply:** 30
- **Mint:** Dutch auction, one per day
- **Start price:** 0.1 ETH (configurable)
- **Reserve price:** 0.01 ETH (configurable)
- **Decay rate:** 0.003 ETH/hour (configurable)
- **Duration:** 24 hours per auction
- **Royalty:** 10% (ERC-2981)

## Testing

```bash
# Install dependencies
pnpm install

# Compile contracts
pnpm compile

# Run tests
pnpm test

# Run with gas reporting
pnpm test:gas

# Coverage
pnpm coverage
```

Tests cover: deployment, auction mechanics (start, mint, price decay, refund, sequential auctions), trait generation determinism, deposit/withdrawal indexing, token URI, admin controls, and season completeness (30-gallery cap).

## Deployment

Targets **Base** (mainnet) and **Base Goerli** (testnet).

```bash
# Set DEPLOYER_PRIVATE_KEY and BASESCAN_API_KEY in .env

# Deploy to Base Goerli
pnpm deploy:base-goerli

# Deploy to Base mainnet
pnpm deploy:base

# Verify on Basescan
pnpm verify --network base <CONTRACT_ADDRESS> <REGISTRY_ADDRESS> <IMPLEMENTATION_ADDRESS>
```

Constructor args: `(address _registry, address _implementation)` — the ERC-6551 registry and token-bound account implementation addresses.

## License

MIT
