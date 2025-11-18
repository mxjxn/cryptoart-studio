# CreatePoolForm Testing Guide

This guide walks you through testing the `CreatePoolForm` component with real contract interactions.

## Prerequisites

1. **Wallet Connected**: Make sure your wallet is connected to Base Mainnet (8453) or Base Sepolia (84532)
2. **NFT Contract**: You need a deployed ERC721 NFT contract address
3. **Test ETH**: Have some ETH in your wallet for gas fees

## Component Features

The `CreatePoolForm` component now includes:

✅ **Input Validation**
- Validates spot price > 0
- Validates delta > 0
- Validates fee is between 0-10000 BPS (0-100%)
- Validates NFT contract address format

✅ **Pool Address Extraction**
- Automatically extracts pool address from transaction receipt
- Parses `NewERC721Pair` event from factory contract
- Displays pool address and explorer links on success

✅ **Error Handling**
- Shows validation errors before submission
- Displays transaction errors from wagmi
- Clear error messages for debugging

✅ **Chain Support**
- Automatically detects chain ID (Base Mainnet or Sepolia)
- Shows correct explorer links based on chain

## Testing Steps

### 1. Prepare Your NFT Contract

You'll need an ERC721 contract address. For testing, you can use:
- Your deployed Creator Core contract from Base Sepolia: `0x6302C5F1F2E3d0e4D5ae5aeB88bd8044c88Eef9A`
- Or deploy a new one using the ContractDeployer component

### 2. Fill in Pool Parameters

**Spot Price (ETH)**: The initial price per NFT
- Example: `0.01` (0.01 ETH)
- This is the starting price for the first NFT in the pool

**Delta (ETH)**: The price change per NFT
- Example: `0.001` (0.001 ETH)
- Each NFT sold increases the price by this amount
- For linear curves: price increases linearly
- For exponential curves: price increases exponentially

**Fee (BPS)**: Pool fee in basis points
- Example: `100` = 1% fee
- Example: `500` = 5% fee
- Maximum: `10000` = 100% (not recommended!)

**Bonding Curve Type**:
- **Linear**: Price increases linearly (recommended for testing)
- **Exponential**: Price increases exponentially
- **XYK**: Constant product formula (like Uniswap)
- **GDA**: Gradual Dutch Auction

### 3. Submit Transaction

1. Click "Create Pool"
2. Approve the transaction in your wallet
3. Wait for confirmation (usually 1-2 seconds on Base)
4. The component will automatically:
   - Wait for transaction confirmation
   - Parse the `NewERC721Pair` event
   - Extract and display the pool address
   - Show explorer links

### 4. Verify Pool Creation

After successful creation, you should see:
- ✅ Success message
- Pool address (if extracted successfully)
- Link to view pool on BaseScan
- Link to view transaction on BaseScan

## Expected Transaction Flow

```
1. User fills form → Validates inputs
2. User clicks "Create Pool" → Shows "Creating..." state
3. Wallet prompts for approval → User approves
4. Transaction submitted → Shows "Confirming..." state
5. Transaction confirmed → Extracts pool address from receipt
6. Success screen → Shows pool address and links
```

## Troubleshooting

### "Invalid NFT contract address"
- Make sure the address is a valid Ethereum address (0x followed by 40 hex characters)
- Check that the contract is deployed on the same network you're connected to

### "Failed to create pool" / Transaction Reverts
Common reasons:
1. **Insufficient gas**: Make sure you have enough ETH for gas
2. **Invalid parameters**: Check that spot price and delta are reasonable values
3. **Contract not ERC721**: The contract must be a valid ERC721 contract
4. **Factory address mismatch**: Make sure you're on the correct network (Base Mainnet or Sepolia)

### Pool address not extracted
If the transaction succeeds but pool address isn't shown:
- Check browser console for errors
- The transaction hash is still shown, you can manually check on BaseScan
- Look for the `NewERC721Pair` event in the transaction logs

### "Please connect your wallet"
- Make sure your wallet is connected
- Check that you're connected to Base Mainnet (8453) or Base Sepolia (84532)

## Testing on Base Sepolia

For testing, use Base Sepolia:
- **Chain ID**: 84532
- **LSSVM Factory**: `0x372990Fd91CF61967325dD5270f50c4192bfb892`
- **Explorer**: https://sepolia.basescan.org

Note: Bonding curve addresses for Sepolia may differ. Check the LSSVM deployment docs for Sepolia addresses.

## Next Steps After Pool Creation

Once your pool is created:
1. **Add NFTs to Pool**: Use the LSSVM Router to deposit NFTs
2. **Add Liquidity**: Deposit ETH to enable buying
3. **View Pool**: Check pool status on BaseScan or via the unified indexer
4. **Test Buying**: Try buying an NFT from the pool

## Code Structure

The component uses:
- `useWriteContract` - Submits the transaction
- `useWaitForTransactionReceipt` - Waits for confirmation
- `usePublicClient` - Reads the transaction receipt
- `decodeEventLog` - Extracts pool address from event logs

## Related Documentation

- [LSSVM Integration Guide](../LSSVM_INTEGRATION.md)
- [Contract Addresses](../../CONTRACT_ADDRESSES.md)
- [Unified Indexer](../../packages/unified-indexer/README.md)

