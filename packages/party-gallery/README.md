# Party Gallery

**Party Protocol + ERC-6551 integration for collective NFT curation**

This package enables DAOs to collectively curate and manage NFT galleries using Party Protocol for governance and ERC-6551 Token Bound Accounts for asset custody.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PARTY DAO                                   │
│                  (Members vote on proposals)                        │
│                              │                                      │
│                              ▼                                      │
│                   ┌─────────────────┐                              │
│                   │   GalleryNFT    │  ◄── Party owns this NFT     │
│                   │   (ERC-721)     │                              │
│                   └────────┬────────┘                              │
│                            │                                        │
│                            ▼                                        │
│                   ┌─────────────────┐                              │
│                   │ GalleryAccount  │  ◄── 6551 Token Bound Account│
│                   │ (Smart Wallet)  │                              │
│                   └────────┬────────┘                              │
│                            │                                        │
│          ┌─────────────────┼─────────────────┐                     │
│          ▼                 ▼                 ▼                     │
│    ┌──────────┐     ┌──────────┐     ┌──────────┐                 │
│    │  NFT #1  │     │  NFT #2  │     │  NFT #3  │  ◄── Collection │
│    └──────────┘     └──────────┘     └──────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Contracts

| Contract | Description |
|----------|-------------|
| `GalleryNFT` | ERC-721 representing a curated gallery |
| `GalleryAccount` | ERC-6551 account implementation for galleries |
| `GalleryActions` | Library for building marketplace action calldata |
| `PartyGalleryFactory` | Factory for creating Party-owned galleries |

## How It Works

### 1. Create a Party-Owned Gallery

```solidity
// Party already exists at partyAddress
PartyGalleryFactory factory = PartyGalleryFactory(FACTORY_ADDRESS);

(uint256 galleryTokenId, address galleryAccount) = factory.createPartyGallery(
    partyAddress,
    "Collective Gallery",
    "A DAO-curated art collection",
    "https://example.com/gallery"
);
```

### 2. Bid on an Auction (via Party Proposal)

Party members create a proposal to bid:

```solidity
// Build the action calldata
bytes memory bidData = GalleryActions.encodeBidExecution(
    galleryAccount,
    MARKETPLACE_ADDRESS,
    listingId,
    1 ether,      // bid amount
    address(0)    // no referrer
);

// Create Party proposal (simplified)
party.propose(Proposal({
    maxExecutableTime: uint40(block.timestamp + 7 days),
    cancelDelay: 1 days,
    proposalData: abi.encode(
        galleryAccount,  // target
        1 ether,         // value
        bidData          // calldata
    )
}));
```

### 3. List an NFT for Sale

```solidity
bytes memory listData = GalleryActions.encodeCreateListingExecution(
    MARKETPLACE_ADDRESS,
    nftContract,
    tokenId,
    IMarketplace.TokenSpec.ERC721,
    1,                                    // amount
    IMarketplace.ListingType.INDIVIDUAL_AUCTION,
    0.5 ether,                           // starting price
    address(0),                          // ETH payment
    uint40(block.timestamp),             // start now
    uint40(block.timestamp + 7 days)     // 7 day auction
);

// Submit as Party proposal...
```

### 4. Transfer NFT to a Member

```solidity
(address target, uint256 value, bytes memory data) = GalleryActions.buildTransferNFTAction(
    nftContract,
    tokenId,
    recipientAddress,
    false,  // not ERC1155
    1
);

// Submit as Party proposal with the gallery account as the "from" address...
```

## Governance Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Member     │───▶│   Propose    │───▶│    Vote      │───▶│   Execute    │
│   Action     │    │   (create)   │    │  (accept)    │    │   (call)     │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                   │
                                                                   ▼
                                                          ┌──────────────┐
                                                          │   Gallery    │
                                                          │   Account    │
                                                          │   executes   │
                                                          └──────────────┘
```

## Supported Actions

| Action | Description | Function |
|--------|-------------|----------|
| Bid | Place bid on auction | `GalleryActions.buildBidAction` |
| Purchase | Buy fixed-price listing | `GalleryActions.buildPurchaseAction` |
| Create Listing | List gallery NFT for sale | `GalleryActions.buildCreateListingAction` |
| Create Offer | Make offer on listing | `GalleryActions.buildCreateOfferAction` |
| Accept Offer | Accept offer on gallery's listing | `GalleryActions.buildAcceptOfferAction` |
| Transfer NFT | Send NFT to address | `GalleryActions.buildTransferNFTAction` |
| Transfer ETH | Send ETH to address | `GalleryActions.buildTransferETHAction` |
| Transfer ERC20 | Send tokens to address | `GalleryActions.buildTransferERC20Action` |

## Deployment

### Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install
```

### Deploy to Testnet

```bash
# Set environment variables
export PRIVATE_KEY=your_private_key
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Deploy
forge script scripts/Deploy.s.sol:DeployTestnet \
  --rpc-url base-sepolia \
  --broadcast \
  --verify
```

### Deploy to Mainnet

```bash
export PRIVATE_KEY=your_private_key
export BASE_RPC_URL=https://mainnet.base.org
export BASESCAN_API_KEY=your_api_key

forge script scripts/Deploy.s.sol:Deploy \
  --rpc-url base \
  --broadcast \
  --verify
```

## External Dependencies

| Dependency | Address | Notes |
|------------|---------|-------|
| ERC-6551 Registry | `0x000000006551c19487814612e58FE06813775758` | Same on all chains |
| Party Protocol | [Varies by chain](https://docs.partydao.org) | For governance |
| Marketplace | Your deployment | CryptoArt Studio marketplace |

## Security Considerations

1. **Gallery Account Authorization**: Only the GalleryNFT owner (the Party) can execute actions through the account
2. **Proposal Validation**: Party governance ensures multiple members approve significant actions
3. **Precious Token Protection**: Party can mark valuable NFTs as "precious" for additional protection
4. **Reentrancy**: GalleryAccount uses state updates before external calls

## Development

```bash
# Build
forge build

# Test
forge test

# Format
forge fmt

# Gas report
forge test --gas-report
```

## License

MIT
