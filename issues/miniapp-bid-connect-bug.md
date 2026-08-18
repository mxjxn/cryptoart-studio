# Cannot place bids in Farcaster mini app (mobile) — connector lookup never matches, `isConnected` stays false

## Symptom

On mobile in the Farcaster mini app, tapping **Place Bid** does nothing. No error, no wallet prompt, no toast. The same auction works fine in a regular mobile/desktop web browser (wallet connects via RainbowKit, bid flow completes).

## Root cause

`MiniAppAutoConnect` in `apps/mvp/src/components/providers/WagmiProvider.tsx` (lines ~105–121) looks up the Farcaster wallet connector by the wrong id/name:

```ts
const farcasterConnector = connectors.find(
  (c) => c.id === 'farcasterMiniApp' || c.name === 'Farcaster Frame'
);
```

But the connector created by `farcasterFrame()` from `@farcaster/miniapp-wagmi-connector` (v1.0.0 and v1.1.0 — identical) registers as:

```js
// node_modules/@farcaster/miniapp-wagmi-connector/dist/connector.js
id: 'farcaster',
name: 'Farcaster',
rdns: 'xyz.farcaster.MiniAppWallet',
type: 'farcasterMiniApp',   // <- note: type, not id
```

(`farcasterFrame` is just an alias of `farcasterMiniApp` — same object, same id.)

So `find()` **always returns `undefined`**. The subsequent `if (farcasterConnector)` guard means `connect()` is never called — silently, with no error logged. Result:

1. wagmi `isConnected` stays `false` for the whole session
2. `useEffectiveAddress()` returns `isConnected: false`
3. `handleBid` in `apps/mvp/src/hooks/useAuctionDetail.ts` (line 768) bails on its first guard:
   ```ts
   if (!isConnected || !bidAmount || !auction || !address) {
     return;   // <- silent no-op, exactly the reported behavior
   }
   ```

On the web this doesn't reproduce because the user connects manually through the RainbowKit modal (injected/Coinbase/WalletConnect connectors), which sets `isConnected` normally. Only the mini app auto-connect path is broken.

**Note:** this bug is not a regression — the id has been `'farcaster'` in every published version of `@farcaster/miniapp-wagmi-connector`, so the mini app bid flow has never worked as shipped.

Secondary issue in the same component: `hasAttemptedConnect` is set `true` in the `finally` block even when the connector wasn't found or the connect failed, so there is no retry — the failure is permanent for the session.

## Evidence

- `WagmiProvider.tsx` lookup strings: `'farcasterMiniApp'` (id) / `'Farcaster Frame'` (name)
- Actual connector properties (verified in installed `node_modules` v1.1.0 and unpkg v1.0.0): `id: 'farcaster'`, `name: 'Farcaster'`
- `handleBid` silent guard: `useAuctionDetail.ts:767-770`
- Bid buttons wired directly to `handleBid`: `apps/mvp/src/app/listing/[listingId]/AuctionDetailClient.tsx` lines 859, 889, 927

## Suggested fix

Match on the stable `rdns` (EIP-6963-style) or `type`, either of which is more durable than display strings:

```ts
const farcasterConnector = connectors.find(
  (c) =>
    c.rdns === 'xyz.farcaster.MiniAppWallet' ||
    c.type === 'farcasterMiniApp' ||
    c.id === 'farcaster'
);
```

Also recommended while in there:

1. **Log/telemetry when the connector is not found** — this is what let the bug ship silently.
2. **Retry or surface an error** instead of setting `hasAttemptedConnect = true` unconditionally in `finally` (only set it when a connect was actually attempted or the connector was confirmed absent).
3. **Hardening in `handleBid`**: when `!isConnected` in a mini app context, show a "Connect wallet" prompt instead of a silent return, so any future auto-connect failure is visible to the user.

## Environment

- `@farcaster/miniapp-wagmi-connector` 1.1.0 (semver `^1.0.0`)
- `@farcaster/miniapp-sdk` 0.2.1
- wagmi 2.14.x + RainbowKit 2.2.9
- Affected: all mini app sessions (Warpcast mobile webview); web browser unaffected
