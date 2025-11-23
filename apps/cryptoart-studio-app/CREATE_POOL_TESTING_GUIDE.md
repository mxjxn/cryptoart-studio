# CreatePoolForm Testing Guide

This guide walks you through using the `CreatePoolForm` component for creating LSSVM liquidity pools.

## Prerequisites

1. **Wallet Connected**: Make sure your wallet is connected to Base Mainnet (8453) or Base Sepolia (84532)
2. **NFT Contract**: You need a deployed ERC721 NFT contract address
3. **Test ETH**: Have some ETH in your wallet for gas fees

## Component Status

The `CreatePoolForm` component is currently in development. The UI is implemented, but the actual pool creation functionality is a placeholder pending final LSSVM integration.

**Current State:**
- ✅ UI and form inputs implemented
- ✅ Input validation for spot price, delta, and fee
- ✅ Bonding curve type selection
- ⚠️ Pool creation transaction is a TODO (placeholder)

## Planned Features

When fully implemented, the component will:
- Validate input parameters (spot price, delta, fee)
- Support multiple bonding curve types (linear, exponential, XYK, GDA)
- Extract pool address from transaction receipt
- Parse `NewERC721Pair` event from factory contract
- Display pool address and explorer links on success
- Show proper error messages for transaction failures

## Usage Guide

### 1. Prepare Your NFT Contract

You'll need an ERC721 contract address. For testing, you can:
- Use an existing NFT contract you own
- Deploy a test NFT contract using the TestNFTCollectionDeployer component
- Use the ContractDeployer component to deploy a new collection

### 2. Understanding Pool Parameters

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

## Current Limitations

⚠️ **Important**: The pool creation transaction is currently a placeholder. The actual implementation is pending LSSVM ABI integration. When you click "Create Pool", you'll see a console log of the parameters but no actual transaction will be submitted.

### To Implement

The following steps are needed to complete the implementation:
1. Import proper LSSVM factory ABI
2. Get bonding curve address based on selected type
3. Configure asset recipient address
4. Implement actual `writeContract` call with proper parameters
5. Add transaction receipt parsing for pool address extraction
6. Add success state with pool address and explorer links

## Development Notes

The component structure is in place with proper form validation and UI flow. See the TODO comments in `CreatePoolForm.tsx` for implementation details:

```typescript
// TODO: Implement actual pool creation
// This is a placeholder - actual implementation would:
// 1. Get bonding curve address based on type
// 2. Set asset recipient (could be the creator or a fee recipient)
// 3. Encode parameters and call createPairERC721
```

## Related Documentation

- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Studio app architecture
- [DUAL_MODE_GUIDE.md](./DUAL_MODE_GUIDE.md) - Dual-mode operation guide

