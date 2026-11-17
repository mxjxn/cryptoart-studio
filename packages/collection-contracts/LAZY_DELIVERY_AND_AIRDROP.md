# Lazy Delivery and Multi-Recipient Airdrop Implementation

This document describes the lazy minting/delivery and multi-recipient airdrop features added to the SuchCollection (ERC721) and SuchCollection1155 (ERC1155) contracts.

## Overview

Two major features have been implemented:

1. **Lazy Delivery**: Tokens are minted on-demand when a buyer purchases them through an approved marketplace/auction house
2. **Multi-Recipient Airdrop**: Efficiently distribute tokens to many addresses in a single transaction

Both features are designed to work with the existing auction house contracts on Base and Ethereum mainnet.

## 1. Lazy Delivery Implementation

### Architecture

The lazy delivery feature implements the `ILazyDelivery` interface from the auction house contracts. This allows artists to create marketplace listings for tokens that don't exist yet - the tokens are only minted when someone purchases them.

### Key Components

#### ILazyDelivery Interface

Located at `src/interfaces/ILazyDelivery.sol`, this interface defines the `deliver()` function that marketplaces call to mint tokens to buyers.

```solidity
function deliver(
    uint40 listingId,
    address to,
    uint256 assetId,
    uint24 payableCount,
    uint256 payableAmount,
    address payableERC20,
    uint256 index
) external;
```

#### Marketplace Authorization

Both collection contracts maintain a mapping of approved marketplace addresses:

```solidity
mapping(address => bool) private _approvedMarketplaces;
```

**Management Functions:**
- `setMarketplaceApproval(address marketplace, bool approved)` - Owner-only function to authorize/revoke marketplaces
- `isMarketplaceApproved(address marketplace)` - Check if a marketplace is approved

#### ERC721 Implementation (SuchCollection)

**Workflow:**
1. Artist calls `setTokenURIForLazyMint(tokenId, uri)` to preset metadata for a future token
2. Artist creates a lazy listing on the marketplace (off-chain or via marketplace UI)
3. Buyer purchases through marketplace
4. Marketplace calls `deliver()` which mints the token directly to the buyer

**Key Features:**
- Token URI can be set before the token exists
- Token count is automatically updated when tokens are minted out of sequence
- Access control ensures only approved marketplaces can call `deliver()`
- Emits `LazyDelivered` event for indexing

**Storage Considerations:**
- No additional storage slots required per token
- Uses existing `_tokenURIs` mapping
- No impact on upgrade/clone patterns

#### ERC1155 Implementation (SuchCollection1155)

**Workflow:**
1. Artist calls `prepareLazyToken(uri, maxSupply)` to create a token ID with metadata but zero supply
2. Artist creates a lazy listing on the marketplace
3. Buyers purchase through marketplace
4. Marketplace calls `deliver()` which mints the specified amount to each buyer

**Key Features:**
- Supports both limited and unlimited supply editions
- Can deliver multiple units per transaction
- Tracks `totalMinted` vs `maxSupply` to enforce caps
- Allows multiple deliveries to different buyers for the same token ID

**Additional Function:**
- `prepareLazyToken(string calldata tokenURI_, uint256 maxSupply_)` - Creates a token ID without minting supply

### Security Considerations

1. **Access Control**: Only owner-approved marketplaces can call `deliver()`
2. **Reentrancy Protection**: All delivery functions use `nonReentrant` modifier
3. **Input Validation**: 
   - Validates recipient address is not zero
   - Checks token doesn't already exist (ERC721) or has supply available (ERC1155)
   - Validates delivery count matches token type (1 for ERC721, any for ERC1155)
4. **Supply Enforcement**: ERC1155 respects `maxSupply` caps across multiple deliveries

### Gas Optimization

- Uses existing storage slots where possible
- Batch operations minimize per-token overhead
- No unnecessary state updates

## 2. Multi-Recipient Airdrop Implementation

### Architecture

Both contracts implement efficient airdrop functions that mint to multiple recipients in a single transaction.

### ERC721 Airdrop (SuchCollection)

```solidity
function airdrop(
    address[] calldata recipients,
    string[] calldata uris
) external onlyOwner nonReentrant returns (uint256[] memory tokenIds)
```

**Features:**
- Mints one unique token per recipient
- Each token can have a different URI
- Returns array of minted token IDs
- Gas efficient: ~50k gas per recipient

**Batch Limits:**
- Hard cap: 500 recipients per transaction (safety limit)
- Recommended: 200-300 recipients for optimal gas usage
- Larger airdrops should be split into multiple transactions

**Use Cases:**
- Studio membership rewards (all active STP members)
- Community giveaways
- Event participation rewards

### ERC1155 Airdrop (SuchCollection1155)

```solidity
function airdrop(
    address[] calldata recipients,
    uint256 tokenId,
    uint256[] calldata amounts
) external onlyOwner nonReentrant
```

**Features:**
- Distributes editions of a single token ID to multiple recipients
- Each recipient can receive a different amount
- Respects `maxSupply` constraints
- Gas efficient: ~35k gas per recipient

**Batch Limits:**
- Hard cap: 500 recipients per transaction (safety limit)
- Recommended: 300-400 recipients for optimal gas usage

**Use Cases:**
- Edition distribution (all STP NFT holders receive 10 editions each)
- Tiered rewards (different amounts based on membership level)
- DAO token distribution

### Security Considerations

1. **Access Control**: Only the collection owner can initiate airdrops
2. **Input Validation**:
   - Rejects empty recipient lists
   - Validates array length matching
   - Rejects zero addresses
   - Validates all amounts > 0 (ERC1155)
3. **Supply Management**: ERC1155 airdrops respect token supply caps
4. **Reentrancy Protection**: Both functions use `nonReentrant` modifier

### Gas Estimation

**ERC721 Airdrop:**
- Base cost: ~21,000 gas (transaction overhead)
- Per recipient: ~50,000 gas
- Example: 100 recipients ≈ 5,021,000 gas
- Example: 200 recipients ≈ 10,021,000 gas

**ERC1155 Airdrop:**
- Base cost: ~21,000 gas (transaction overhead)
- Per recipient: ~35,000 gas
- Example: 100 recipients ≈ 3,521,000 gas
- Example: 300 recipients ≈ 10,521,000 gas

## Testing

Comprehensive test suites are provided:

### LazyDelivery.t.sol (25 tests)

Tests covering:
- ILazyDelivery interface support
- Marketplace approval management
- Successful delivery scenarios
- Access control enforcement
- Error conditions (unauthorized caller, invalid inputs, supply constraints)
- Integration between ERC721 and ERC1155
- Marketplace revocation

### Airdrop.t.sol (23 tests)

Tests covering:
- Basic airdrop functionality
- Large batch operations (up to 200 recipients)
- Array length validation
- Supply cap enforcement (ERC1155)
- Access control
- Error conditions
- Edge cases (same recipient multiple times, sequential with regular mints)

**Run tests:**
```bash
forge test                                          # All tests
forge test --match-path test/LazyDelivery.t.sol   # Lazy delivery only
forge test --match-path test/Airdrop.t.sol         # Airdrop only
```

All 82 tests pass successfully.

## Integration with Auction House

### Supported Marketplaces

The contracts are designed to work with the deployed auction house contracts:

**Base Sepolia:**
- Marketplace Proxy: `0xfd35bF63448595377d5bc2fCB435239Ba2AFB3ea`

**Base Mainnet:**
- Marketplace Proxy: `0xBB428171D8B612D7185A5C25118Ef7EdC3089B37`

**Ethereum Mainnet:**
- (Deploy addresses TBD)

### Setup Process

1. **Deploy Collection**: Use the factory or deploy directly
2. **Approve Marketplace**: 
   ```solidity
   collection.setMarketplaceApproval(MARKETPLACE_ADDRESS, true);
   ```
3. **Prepare Lazy Tokens**:
   - ERC721: `collection.setTokenURIForLazyMint(tokenId, uri)`
   - ERC1155: `collection.prepareLazyToken(uri, maxSupply)`
4. **Create Listing**: Use marketplace UI or contract directly
5. **Buyers Purchase**: Marketplace calls `deliver()` automatically on settlement

### Interface Verification

Both contracts properly implement and advertise `ILazyDelivery` via ERC-165:

```solidity
collection.supportsInterface(type(ILazyDelivery).interfaceId); // returns true
```

The marketplace contracts verify this interface before accepting lazy listings.

## Storage Layout

### SuchCollection (ERC721)

New storage variables added:
```solidity
mapping(address => bool) private _approvedMarketplaces;
```

**Location**: After existing variables, no conflicts with existing storage layout.

**Upgradeability**: Compatible with clone pattern. No impact on existing proxies.

### SuchCollection1155

New storage variables added:
```solidity
mapping(address => bool) private _approvedMarketplaces;
```

**Location**: After existing variables.

**Upgradeability**: Compatible with existing patterns.

### Migration Considerations

For existing deployed collections:
- No migration needed - new functionality is additive
- Lazy delivery requires explicit marketplace approval
- Existing functionality unchanged

## Deployment Steps for Max

These contracts are ready for local deployment and testing. The deployment process:

### 1. Install Dependencies

```bash
cd packages/collection-contracts
forge install
```

### 2. Compile Contracts

```bash
forge build
```

### 3. Run Tests

```bash
forge test -vv
```

All tests should pass (82/82).

### 4. Deploy to Local Testnet (Anvil)

```bash
# Terminal 1: Start local node
anvil

# Terminal 2: Deploy contracts
forge script script/DeployFactory.s.sol --rpc-url http://localhost:8545 --broadcast
```

### 5. Test End-to-End with Local Auction House

The `script/e2e-local.sh` script can be extended to test:
1. Deploy collection via factory
2. Approve local marketplace
3. Prepare lazy token
4. Simulate marketplace delivery
5. Verify token minted correctly

### 6. Deploy to Testnet (Base Sepolia)

After local testing:

```bash
# Set up .env with private key and RPC URL
forge script script/deploy-preview-base-sepolia.sh
```

### 7. Verify Contracts

```bash
forge verify-contract <ADDRESS> SuchCollection --chain-id 84532
forge verify-contract <ADDRESS> SuchCollection1155 --chain-id 84532
```

## Design Decisions and Trade-offs

### 1. Token ID Management for Lazy Minting

**Decision**: Allow arbitrary token IDs to be preset and minted out of sequence.

**Rationale**: 
- Artists can reserve specific token IDs for special editions
- Marketplace can use predictable token IDs in listings
- Simplifies coordination between off-chain metadata and on-chain tokens

**Trade-off**: `_tokenCount` may have gaps, but `totalSupply()` remains accurate.

### 2. Marketplace Authorization List

**Decision**: Use a simple mapping rather than a role-based access control system.

**Rationale**:
- Simpler implementation with less gas overhead
- Owner has full control over which marketplaces can mint
- Easy to audit and verify

**Trade-off**: Less granular than full RBAC, but sufficient for the use case.

### 3. ERC1155 prepareLazyToken() Function

**Decision**: Separate function to prepare tokens vs. regular mint().

**Rationale**:
- Makes lazy intent explicit
- Prevents accidentally creating zero-supply tokens through regular mint
- Clear separation of concerns

**Trade-off**: Extra function call needed, but improves clarity and safety.

### 4. Batch Size Limits

**Decision**: Hard cap of 500 recipients per airdrop transaction.

**Rationale**:
- Prevents accidental gas limit exhaustion
- Still allows substantial airdrops in single transaction
- Can split larger airdrops across multiple transactions

**Trade-off**: Very large airdrops require multiple transactions, but this is acceptable given the gas constraints of Ethereum.

### 5. No Token URI Requirement for ERC721 Lazy Delivery

**Decision**: Allow delivery even if URI is not set (will use base URI + token ID).

**Rationale**:
- Flexibility for different metadata strategies
- Some collections use base URI + token ID pattern exclusively
- Artists can still set explicit URIs when needed

**Trade-off**: Must ensure proper URI is set for lazy listings to work as expected.

## Known Limitations and Future Enhancements

### Current Limitations

1. **No Batch Lazy Delivery**: Marketplace must call `deliver()` once per buyer. This is per the ILazyDelivery interface spec.

2. **No Token URI Batching**: Setting URIs for many lazy tokens requires multiple transactions. Could add `batchSetTokenURIForLazyMint()`.

3. **Fixed Batch Limits**: 500 recipient cap may need adjustment based on real-world gas usage patterns.

### Potential Enhancements

1. **Lazy Delivery Hooks**: Add optional callbacks for custom logic during delivery
2. **Metadata Freezing**: Option to lock token URIs after lazy mint
3. **Delivery Scheduling**: Time-based delivery windows
4. **Cross-Collection Airdrops**: Airdrop to holders of other NFT collections

## Open Questions

1. **Arweave Integration**: How should Arweave URIs be handled vs IPFS? (Currently both supported equally)

2. **Metadata Finalization**: Should there be a way to "lock" metadata after lazy minting to prevent changes?

3. **Marketplace Fee Handling**: Does the marketplace handle all fee distribution, or should the contract verify?

4. **Edition Numbering**: For ERC1155, should we track which delivery index each buyer is (e.g., "Edition 5 of 100")?

5. **Batch Delivery**: Would the marketplace benefit from a batch deliver function, or is per-buyer delivery sufficient?

## References

- [Auction House Contracts](https://github.com/mxjxn/auctionhouse-contracts)
- [EIP-2981: NFT Royalty Standard](https://eips.ethereum.org/EIPS/eip-2981)
- [ERC-721: Non-Fungible Token Standard](https://eips.ethereum.org/EIPS/eip-721)
- [ERC-1155: Multi Token Standard](https://eips.ethereum.org/EIPS/eip-1155)
- [Manifold Lazy Delivery](https://docs.manifold.xyz/v/manifold-for-developers/smart-contracts/manifold-creator/extensions/lazy-claim)
