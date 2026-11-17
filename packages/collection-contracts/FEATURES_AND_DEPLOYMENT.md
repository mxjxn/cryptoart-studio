# SuchCollection Features & Deployment Guide

This document covers all features available in the SuchCollection (ERC721) and SuchCollection1155 (ERC1155) contracts for the day one relaunch.

## Feature Matrix

| Feature | SuchCollection (721) | SuchCollection1155 | External Contracts | Notes |
|---------|---------------------|-------------------|-------------------|-------|
| **Lazy Delivery** | ✅ | ✅ | ❌ | Requires SuchCollection - implements ILazyDelivery |
| **Blind Mint/Reveal** | ✅ | ✅ | ❌ | Requires SuchCollection - built-in reveal mechanism |
| **Burn-to-Mint (as source)** | ✅ | ✅ | ✅ | Any ERC721/1155 can be source, including external |
| **Burn-to-Mint (as target)** | ✅ | ✅ | ❌ | Requires SuchCollection - uses extension system |
| **Multi-Recipient Airdrop** | ✅ | ✅ | ❌ | Requires SuchCollection - built-in function |
| **Auction Listings** | ✅ | ✅ | ✅ | Any ERC721/1155 can list existing tokens |
| **Regular Minting** | ✅ | ✅ | ✅ | Standard NFT functionality |

## Overview

Three major features for day one relaunch:

1. **Lazy Delivery**: Tokens minted on-demand when purchased through marketplace
2. **Blind Mint/Reveal**: Collections start with placeholder metadata, artist triggers reveal
3. **Burn-to-Mint**: Burn tokens from one collection (ours or external) to mint in another

## 1. Lazy Delivery

**What it is**: Artists create marketplace listings for tokens that don't exist yet. Tokens are only minted when someone purchases them.

**Why**: Zero upfront gas cost for artists, perfect for editions where many might not sell.

### Implementation Details

- Both ERC721 and ERC1155 implement `ILazyDelivery` interface
- Marketplace must be pre-approved by collection owner
- Token metadata must be preset before listing creation
- Marketplace calls `deliver()` during purchase settlement

### Setup (ERC721)

```solidity
// 1. Approve marketplace
collection.setMarketplaceApproval(MARKETPLACE_ADDRESS, true);

// 2. Preset token URI
collection.setTokenURIForLazyMint(tokenId, "ipfs://metadata-hash");

// 3. Create lazy listing on marketplace (UI or contract)
// marketplace.createListing(..., lazy: true)

// 4. On purchase, marketplace calls:
// collection.deliver(listingId, buyer, tokenId, 1, price, paymentToken, 0);
```

### Setup (ERC1155)

```solidity
// 1. Approve marketplace
collection.setMarketplaceApproval(MARKETPLACE_ADDRESS, true);

// 2. Prepare lazy token
uint256 tokenId = collection.prepareLazyToken("ipfs://metadata", maxSupply);

// 3. Create lazy listing on marketplace
// marketplace.createListing(..., lazy: true)

// 4. On purchase, marketplace calls:
// collection.deliver(listingId, buyer, tokenId, amount, price, paymentToken, 0);
```

### Compatible with External Contracts?

**No.** Lazy delivery requires implementing `ILazyDelivery` and marketplace authorization system. Only SuchCollection contracts support this.

For external contracts, artists must:
- Mint tokens upfront
- List already-minted tokens on marketplace
- Pay gas costs upfront

## 2. Blind Mint / Reveal

**What it is**: All tokens show placeholder metadata until artist triggers reveal. Fair reveals with cryptographic commitment.

**Why**: Common pattern for generative/random collections. Creates anticipation and prevents cherry-picking traits.

### Reveal Approach

We use a **commitment-based reveal**:
1. Artist commits to final metadata hash upfront (before any minting)
2. All tokens return placeholder URI until reveal
3. Artist reveals by providing actual base URI + salt
4. Contract verifies base URI hashes to commitment
5. All tokens instantly show real metadata

**Tradeoffs**:
- ✅ Simple and honest - commitment proves artist didn't change metadata
- ✅ No randomization needed - works for any collection type
- ✅ Gas efficient - single reveal transaction
- ❌ No per-token randomization (all tokens revealed together)
- ❌ Artist must keep salt secret until reveal

**Alternative approaches considered**:
- Randomized offset (e.g., CryptoPunks style): More complex, requires sequential IDs
- VRF oracle: External dependency, gas costs, complexity
- Commit-reveal per token: Too much overhead

### Setup (ERC721)

```solidity
// 1. Calculate commitment hash
string memory revealedBaseURI = "ipfs://revealed-collection/";
bytes32 salt = keccak256("secret-random-salt");
bytes32 commitment = keccak256(abi.encodePacked(revealedBaseURI, salt));

// 2. Configure blind mint
collection.setBlindMintConfig("ipfs://placeholder-mystery", commitment);

// 3. Mint tokens (all will show placeholder)
for (uint i = 0; i < 100; i++) {
    collection.mint(buyer, ""); // URI ignored, uses placeholder
}

// 4. Later, reveal (proves commitment)
collection.reveal(revealedBaseURI, salt);
// Now all tokens show: ipfs://revealed-collection/1, /2, /3, etc.
```

### Setup (ERC1155)

Same pattern:

```solidity
bytes32 commitment = keccak256(abi.encodePacked(revealedBaseURI, salt));
collection.setBlindMintConfig("ipfs://placeholder", commitment);

// Mint editions
collection.mint(buyer, 100, 1000, ""); // URI ignored until reveal

// Reveal
collection.reveal(revealedBaseURI, salt);
```

### Compatible with External Contracts?

**No.** Blind mint/reveal requires built-in placeholder and reveal functions. Only SuchCollection contracts support this.

External contracts would need to:
- Implement their own reveal mechanism
- Or mint with final URIs upfront (no blind mint)

### Can Combine with Other Features?

Yes! Works with:
- **Lazy Delivery**: Preset placeholder, lazy mint, later reveal
- **Airdrop**: Airdrop with placeholder, later reveal
- **Burn-to-Mint**: Burn to mint blind tokens, later reveal

## 3. Burn-to-Mint

**What it is**: Burn tokens from one collection to mint tokens in another. Source can be any ERC721/1155, including external contracts.

**Why**: 
- Upgrade paths (V1 → V2 collections)
- Redeem mechanics (burn membership pass → mint art)
- Cross-project collaborations (burn their NFT → mint ours)

### Implementation

Separate extension contract (`BurnToMintExtension`) manages burn-to-mint configurations.

**Key Features**:
- Supports any ERC721 or ERC1155 as source (ours or external)
- Configurable ratios (e.g., burn 2 source → mint 3 target)
- Safe handling for tokens without burn() function (transfers to dead address)
- Multiple configs per extension (different source/target pairs)

### Setup

```solidity
// 1. Deploy burn-to-mint extension (one per artist/project)
BurnToMintExtension extension = new BurnToMintExtension(artistAddress);

// 2. Register extension with target collection
targetCollection721.registerExtension(address(extension), "");

// 3. For ERC1155 targets, authorize extension
targetCollection1155.setAuthorizedMinter(address(extension), true);

// 4. Create burn config
uint256 configId = extension.createBurnConfig(
    sourceContractAddress,      // Can be external!
    TokenSpec.ERC721,           // Source type
    targetCollectionAddress,    // Must be SuchCollection
    TokenSpec.ERC721,           // Target type
    0,                          // Target token ID (for ERC1155)
    1,                          // Burn ratio (1 source)
    1,                          // Mint ratio (= 1 target)
    true                        // Has burn function?
);

// 5. Users burn to mint
uint256[] memory tokenIds = [1, 2, 3]; // Tokens to burn
string[] memory uris = ["ipfs://new1"]; // URIs for minted tokens
extension.burnToMint(configId, tokenIds, 0, 0, uris);
```

### Source Contract Types

**Our SuchCollections**:
- ✅ Fully supported as source
- ✅ Has burn() function (set requiresBurn: true)
- ✅ Can burn and mint in same transaction

**External ERC721/1155**:
- ✅ Supported as source
- ⚠️ May not have burn() function (set requiresBurn: false)
- ⚠️ If no burn(), transfers to dead address instead
- ⚠️ Must be approved for transfer by user first

### Ratio Examples

**1:1 (Simple)**:
```solidity
burnRatio: 1, mintRatio: 1
// Burn 1 source → Mint 1 target
```

**2:1 (Upgrade)**:
```solidity
burnRatio: 2, mintRatio: 1
// Burn 2 source → Mint 1 target (better quality)
```

**1:3 (Redeem)**:
```solidity
burnRatio: 1, mintRatio: 3
// Burn 1 source → Mint 3 target (edition set)
```

**10:1 (ERC1155 to ERC721)**:
```solidity
burnRatio: 10, mintRatio: 1
// Burn 10 edition tokens → Mint 1 unique token
```

### Compatible with External Contracts?

**As Source**: ✅ Yes! Any ERC721/1155 can be burned to mint SuchCollection tokens.

**As Target**: ❌ No. Target must be SuchCollection (needs extension system).

**Example**: Artist can say "burn any Bored Ape to mint from my collection" by using BAYC address as source.

### Gas Considerations

- ERC721 burn: ~50-100k gas per token
- ERC1155 burn: ~40-80k gas per operation
- Plus target mint costs
- Batch burns save gas (one tx for multiple tokens)

## 4. Multi-Recipient Airdrop

**What it is**: Mint to many addresses in one transaction.

**Why**: Studio rewards, community giveaways, STP holder perks.

### ERC721 Airdrop

```solidity
address[] memory recipients = [addr1, addr2, addr3];
string[] memory uris = ["ipfs://1", "ipfs://2", "ipfs://3"];

collection.airdrop(recipients, uris);
// Mints token to each recipient with specified URI
```

**Limits**:
- Max 500 recipients per transaction (safety)
- Recommended 200-300 for optimal gas
- ~50k gas per recipient

### ERC1155 Airdrop

```solidity
address[] memory recipients = [addr1, addr2, addr3];
uint256[] memory amounts = [10, 20, 15];

collection.airdrop(recipients, tokenId, amounts);
// Mints specified amount to each recipient
```

**Limits**:
- Max 500 recipients per transaction
- Recommended 300-400 for optimal gas
- ~35k gas per recipient

### Compatible with External Contracts?

**No.** Airdrop is a convenience function built into SuchCollection. External contracts would need their own batch mint implementation.

## Testing

All features have comprehensive test coverage:

- **LazyDelivery.t.sol**: 25 tests (marketplace approval, delivery, access control)
- **BlindMint.t.sol**: 24 tests (config, reveal, commitment verification)
- **BurnToMint.t.sol**: 18 tests (ratios, external contracts, error conditions)
- **Airdrop.t.sol**: 23 tests (batch operations, limits, edge cases)

**Total**: 124 tests, 100% pass rate

Run tests:
```bash
forge test                                    # All tests
forge test --match-path test/BlindMint.t.sol # Just blind mint
forge test -vv                               # Verbose output
forge test --gas-report                      # Gas benchmarks
```

## Local Deployment Steps

### Prerequisites

```bash
cd packages/collection-contracts
forge install  # Install dependencies
forge build    # Compile contracts
forge test     # Verify all tests pass
```

### 1. Start Local Node

```bash
anvil
```

### 2. Deploy Factory

```bash
forge script script/DeployFactory.s.sol \
  --rpc-url http://localhost:8545 \
  --broadcast \
  --private-key $PRIVATE_KEY
```

### 3. Deploy Collections via Factory

```javascript
// Using ethers.js or viem
const factory = await ethers.getContractAt("SuchCollectionFactory", FACTORY_ADDRESS);

// Deploy ERC721 collection
const tx = await factory.createCollection(
  "My Collection",
  "MYC",
  royaltyReceiver,  // Artist wallet
  500               // 5% royalty (500 bps)
);
const receipt = await tx.wait();
const collectionAddress = receipt.logs[0].args.collection;

// Deploy ERC1155 collection (requires separate factory - see SuchCollection1155Factory.sol)
```

### 4. Test Lazy Delivery Locally

```bash
# Use script/e2e-local.sh or manual testing:

# 1. Deploy mock marketplace
# 2. Approve marketplace: collection.setMarketplaceApproval(marketplace, true)
# 3. Preset token: collection.setTokenURIForLazyMint(1, "ipfs://...")
# 4. Call deliver from marketplace: collection.deliver(1, buyer, 1, ...)
# 5. Verify: collection.ownerOf(1) == buyer
```

### 5. Test Blind Mint Locally

```bash
# 1. Calculate commitment:
#    baseURI = "ipfs://revealed/"
#    salt = keccak256("secret")
#    commitment = keccak256(abi.encodePacked(baseURI, salt))

# 2. Configure: collection.setBlindMintConfig("ipfs://placeholder", commitment)
# 3. Mint: collection.mint(buyer, "")
# 4. Check: collection.tokenURI(1) == "ipfs://placeholder"
# 5. Reveal: collection.reveal("ipfs://revealed/", salt)
# 6. Check: collection.tokenURI(1) == "ipfs://revealed/1"
```

### 6. Test Burn-to-Mint Locally

```bash
# 1. Deploy extension: new BurnToMintExtension(owner)
# 2. Register: targetCollection.registerExtension(extension, "")
# 3. For 1155: targetCollection.setAuthorizedMinter(extension, true)
# 4. Create config: extension.createBurnConfig(...)
# 5. Mint source tokens to user
# 6. Approve extension if source doesn't have burn()
# 7. Burn to mint: extension.burnToMint(configId, ...)
# 8. Verify target tokens minted
```

### 7. Deploy to Base Sepolia

After local testing:

```bash
# Set environment variables
export PRIVATE_KEY="..."
export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"

# Deploy
./script/deploy-preview-base-sepolia.sh

# Verify contracts
forge verify-contract <FACTORY_ADDRESS> SuchCollectionFactory \
  --chain-id 84532 \
  --etherscan-api-key $BASESCAN_API_KEY

forge verify-contract <COLLECTION_ADDRESS> SuchCollection \
  --chain-id 84532 \
  --etherscan-api-key $BASESCAN_API_KEY
```

### 8. Approve Marketplace on Testnet

```solidity
// Base Sepolia Marketplace: 0xfd35bF63448595377d5bc2fCB435239Ba2AFB3ea

const collection = await ethers.getContractAt("SuchCollection", COLLECTION_ADDRESS);
await collection.setMarketplaceApproval(
  "0xfd35bF63448595377d5bc2fCB435239Ba2AFB3ea",
  true
);
```

### 9. Deploy to Base Mainnet

Same process as Sepolia, but use:
- RPC: `https://mainnet.base.org`
- Marketplace: `0xBB428171D8B612D7185A5C25118Ef7EdC3089B37`
- Chain ID: 8453

## Studio Integration Notes

### For Artists Using Their Own Contracts

**What Works**:
- ✅ List existing tokens on auction house
- ✅ Use their contract as burn-to-mint source
- ✅ Regular buy/sell functionality
- ✅ Royalties (if contract supports EIP-2981)

**What Doesn't Work**:
- ❌ Lazy listings (need to mint upfront)
- ❌ Blind reveal (need their own mechanism)
- ❌ Our airdrop tools (need their own)
- ❌ Burn-to-mint as target (can be source only)

### Recommended Workflow

**For new collections**: Use SuchCollection factory
- Access to all features
- Gas optimized
- Well tested
- Studio UI support

**For existing collections**: Import and list
- Artists keep their contract
- Can still list on marketplace
- Can be burn-to-mint source
- Limited to basic features

### UI Considerations

1. **Collection Creation**: Offer choice of ERC721 vs ERC1155
2. **Lazy Listings**: Only show option for SuchCollections
3. **Blind Mint**: Show commitment calculator in UI
4. **Burn-to-Mint**: Support contract address input for external sources
5. **Airdrop**: CSV upload for recipient lists

## Gas Estimates

| Operation | ERC721 | ERC1155 | Notes |
|-----------|--------|---------|-------|
| Deploy Collection | ~2.5M | ~1.8M | One-time |
| Regular Mint | ~80k | ~60k | Per token |
| Lazy Delivery | ~155k | ~160k | Per delivery |
| Blind Config | ~60k | ~60k | One-time |
| Reveal | ~50k | ~50k | One-time |
| Airdrop (per recipient) | ~50k | ~35k | Batch savings |
| Burn-to-Mint (721→721) | ~200k | - | Includes burn+mint |
| Burn-to-Mint (1155→1155) | - | ~150k | More efficient |

## Security Considerations

1. **Lazy Delivery**:
   - Only approved marketplaces can mint
   - Token count managed carefully for out-of-sequence mints
   - Reentrancy protection on all paths

2. **Blind Reveal**:
   - Cryptographic commitment prevents metadata changes
   - Artist must keep salt secret
   - Single reveal per collection (cannot re-blind)

3. **Burn-to-Mint**:
   - Users must own source tokens
   - Safe handling of contracts without burn()
   - Extension approval required for target minting

4. **Airdrop**:
   - Owner-only function
   - Batch size limits prevent gas exhaustion
   - Validates all addresses

## Storage Layout

All new features are storage-compatible with existing clone/proxy patterns:

**SuchCollection additions**:
```solidity
mapping(address => bool) private _approvedMarketplaces;
bool private _isRevealed;
string private _placeholderURI;
bytes32 private _metadataCommitment;
```

**SuchCollection1155 additions**:
```solidity
mapping(address => bool) private _approvedMarketplaces;
mapping(address => bool) private _authorizedMinters;
bool private _isRevealed;
string private _placeholderURI;
bytes32 private _metadataCommitment;
```

**BurnToMintExtension**: Separate contract, no impact on collection storage.

## Troubleshooting

### Lazy Delivery Not Working
- Check marketplace is approved: `collection.isMarketplaceApproved(marketplace)`
- Verify token URI is preset: `collection.setTokenURIForLazyMint(...)`
- Ensure marketplace has ILazyDelivery interface check

### Reveal Not Working
- Verify commitment hash matches: recalculate with same base URI + salt
- Check not already revealed: `collection.isRevealed()`
- Ensure blind mint was configured before any minting

### Burn-to-Mint Fails
- For ERC721 source: user must own token
- For external sources: user must approve extension
- If no burn() function: set requiresBurn: false
- For ERC1155 target: extension must be authorized minter

### Airdrop Gas Issues
- Reduce batch size (try 200 instead of 500)
- Split into multiple transactions
- Use Flashbots/private RPC for large batches on mainnet

## Next Steps

After deployment:
1. Test end-to-end on Sepolia with real marketplace
2. Verify contract source code on Basescan
3. Test blind reveal flow with actual metadata
4. Set up burn-to-mint configs for any migrations
5. Prepare airdrop lists for launch rewards
6. Deploy to mainnet (Base + Ethereum)
