# Auction House Indexer Guide

## Contract Information

### 1. Auction House Contract
- **Address**: `0x1cb0c1f72ba7547fc99c4b5333d8aba1ed6b31a9`
- **Network**: Base Mainnet (Chain ID: 8453)
- **Purpose**: Manages the core auction functionality

#### Key Events
- `AuctionCreated`: Emitted when a new auction is created
  ```solidity
  event AuctionCreated(
      uint256 indexed auctionId,
      address indexed tokenContract,
      uint256 indexed tokenId,
      address seller,
      uint256 reservePrice,
      uint256 startTime,
      uint256 endTime,
      address paymentToken
  )
  ```

- `AuctionBid`: Emitted when a bid is placed
  ```solidity
  event AuctionBid(
      uint256 indexed auctionId,
      address bidder,
      uint256 amount,
      uint256 endTime
  )
  ```

- `AuctionSettled`: Emitted when an auction is settled
  ```solidity
  event AuctionSettled(
      uint256 indexed auctionId,
      address winner,
      uint256 amount
  )
  ```

- `AuctionCanceled`: Emitted when an auction is canceled
  ```solidity
  event AuctionCanceled(
      uint256 indexed auctionId
  )
  ```

### 2. NFT Contract (Token Contract)
- **Address**: [TO BE DETERMINED]
- **Purpose**: Represents the NFTs being auctioned
- **Standard**: Likely ERC-721 or ERC-1155

## Implementation Status

### Current Functionality
- ✅ Connection to Base Mainnet via Alchemy RPC
- ✅ Basic contract interaction setup
- ✅ Event listening structure
- ✅ Retry logic for failed RPC calls

### Known Issues
1. **Contract ABI**
   - Current ABI is minimal and might be missing functions/events
   - Full ABI should be verified from Etherscan

2. **Event Processing**
   - Needs testing with real events
   - Requires more robust error handling

3. **Token Contract Integration**
   - NFT contract address not specified
   - Need to add support for querying NFT metadata

4. **Error Handling**
   - Need to handle rate limiting
   - Should add reconnection logic for WebSocket drops

## Troubleshooting

### Common Issues
1. **Connection Failures**
   - Verify Alchemy API key has access to Base Mainnet
   - Check network connectivity
   - Ensure the Alchemy app is configured for Base Mainnet

2. **Event Not Capturing**
   - Verify the contract address is correct
   - Check if the event signatures match the contract
   - Ensure the block range being queried contains the events

3. **Rate Limiting**
   - The indexer includes basic rate limiting handling
   - If seeing rate limit errors, increase the delay between retries

## Development Notes
- The indexer is designed to be fault-tolerant and resume from the last processed block
- All configuration is in `config.js`
- Environment variables are loaded from `.env`