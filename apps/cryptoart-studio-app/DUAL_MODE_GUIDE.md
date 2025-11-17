# Dual-Mode App Guide: Mini-App & Regular Web3

The CryptoArt Studio App functions as **both** a Farcaster mini-app and a regular web3 application. This guide explains how the intelligent wallet handling works.

## Overview

The app automatically detects its context and adapts accordingly:

- **Farcaster Mini-App Context**: Uses Farcaster authentication and wallet
- **Regular Web3 Context**: Uses standard wallet connectors (MetaMask, Coinbase Wallet, etc.)

## How It Works

### Context Detection

The `useIsMiniApp()` hook detects the context by checking:

1. **Neynar Context**: If `context?.user?.fid` exists
2. **Window Properties**: Checks for Farcaster-specific properties
3. **URL Indicators**: Looks for Farcaster-related URL patterns
4. **Ethereum Provider**: Checks for Farcaster Frame provider

```typescript
// Usage in components
import { useIsMiniApp } from "~/hooks/useIsMiniApp";

function MyComponent() {
  const isMiniApp = useIsMiniApp();
  
  if (isMiniApp) {
    // Mini-app specific logic
  } else {
    // Regular web3 logic
  }
}
```

### Wallet Connection

The `WagmiProvider` intelligently handles wallet connections:

**In Mini-App Context:**
- Auto-connects using Farcaster Frame connector
- Wallet is provided by the Farcaster client

**In Regular Web3 Context:**
- Auto-connects to available wallet (Coinbase Wallet, MetaMask)
- Falls back gracefully if no wallet detected
- User can manually connect via wallet buttons

### Authentication

The `AuthWrapper` component handles authentication differently based on context:

**In Mini-App Context:**
- Requires Farcaster authentication via QuickAuth
- Shows sign-in flow if not authenticated
- Uses Farcaster user context

**In Regular Web3 Context:**
- No Farcaster authentication required
- Only requires wallet connection
- Renders content immediately (wallet connection is optional for viewing)

## API Endpoints

**All API endpoints work the same in both contexts.** The app doesn't need different endpoints because:

1. **Wallet Address**: Both contexts provide wallet addresses via `useAccount()`
2. **User Identification**: 
   - Mini-app: Uses Farcaster FID from context
   - Web3: Uses wallet address
3. **Authentication**: Handled client-side, not in API routes

### Example API Usage

```typescript
// Works in both contexts
const { address } = useAccount();

// In mini-app, you can also get FID
const { context } = useMiniApp();
const fid = context?.user?.fid;

// API call
fetch('/api/studio/contracts', {
  headers: {
    'x-wallet-address': address,
    // Optional: include FID if in mini-app
    ...(fid && { 'x-farcaster-fid': fid.toString() }),
  },
});
```

## Studio Components

All studio components (ContractDeployer, NFTMinter, etc.) work in both contexts:

- They use `useAccount()` from wagmi (works in both)
- They don't depend on Farcaster-specific features
- Wallet connection is handled automatically

## Best Practices

### 1. Always Use `useAccount()` for Wallet

```typescript
// ✅ Good - works in both contexts
const { address, isConnected } = useAccount();

// ❌ Bad - only works in mini-app
const { context } = useMiniApp();
const wallet = context?.user?.verifications?.[0];
```

### 2. Conditionally Use Farcaster Features

```typescript
const isMiniApp = useIsMiniApp();
const { context } = useMiniApp();

// Only use Farcaster features in mini-app context
if (isMiniApp && context?.user) {
  // Use Farcaster-specific features
  const fid = context.user.fid;
  // Send notifications, etc.
}
```

### 3. Don't Block Regular Web3 Users

```typescript
// ✅ Good - allows both contexts
if (isMiniApp) {
  // Mini-app specific UI
} else {
  // Regular web3 UI
}

// ❌ Bad - blocks regular web3 users
if (!isMiniApp) {
  return <FarcasterPrompt />;
}
```

## Testing

### Test as Mini-App

1. Deploy to a public URL
2. Add to Farcaster manifest
3. Open in Warpcast or other Farcaster client
4. Should auto-connect with Farcaster wallet

### Test as Regular Web3 App

1. Open in regular browser (Chrome, Firefox, etc.)
2. Install MetaMask or Coinbase Wallet extension
3. Should auto-connect to available wallet
4. No Farcaster authentication required

## Troubleshooting

### Wallet Not Connecting

- **Mini-App**: Ensure Farcaster client supports wallet provider
- **Web3**: Check browser console for connector errors
- **Both**: Verify wagmi config includes appropriate connectors

### Authentication Issues

- **Mini-App**: Check QuickAuth status in console
- **Web3**: Authentication not required - only wallet connection needed

### API Errors

- Ensure API routes accept both wallet address and FID
- Check headers are being sent correctly
- Verify CORS settings allow both contexts

## Architecture

```
┌─────────────────────────────────────┐
│         App Entry Point             │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                 │
┌──────▼──────┐  ┌──────▼──────┐
│  Mini-App   │  │ Regular Web3 │
│   Context   │  │   Context    │
└──────┬──────┘  └──────┬──────┘
       │                 │
       └───────┬─────────┘
               │
    ┌──────────▼──────────┐
    │  WagmiProvider      │
    │  (Smart Connectors) │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │  AuthWrapper        │
    │  (Context-Aware)    │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │  Studio Components  │
    │  (Universal)        │
    └─────────────────────┘
```

## Summary

The app intelligently adapts to its context without requiring different code paths or endpoints. The key is:

1. **Context Detection**: `useIsMiniApp()` hook
2. **Smart Wallet Connection**: WagmiProvider with intelligent auto-connect
3. **Context-Aware Auth**: AuthWrapper handles both modes
4. **Universal Components**: Studio components work in both contexts

This allows the same codebase to serve both Farcaster mini-app users and regular web3 users seamlessly.

