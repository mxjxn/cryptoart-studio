# Miniapp: mainnet bid still fails silently after #185 — FC wallet stuck on Base + zero error surfacing

## Symptom

After #185 (write context now correctly derived from `auction.chainId`), bidding on a **mainnet** auction **inside the Farcaster miniapp** still fails silently. Browser (regular wallet) works. The button flips to "Processing..." briefly, then returns to normal with no error, no toast, no wallet prompt.

## What #185 changed and why it wasn't enough

#185 fixed *which contract* the write targets (mainnet marketplace, chainId 1 — correct now). But it didn't change *the wallet's chain*. The failure moved from "wrong contract on Base" to "right contract on mainnet, but the FC wallet never gets there":

### Failure chain (miniapp, mainnet listing)

1. **FC wallet connects on Base.** `MiniAppAutoConnect` → `farcasterFrame` connector `connect()` → connector picks `targetChainId = config.chains[0].id` = **8453** (WagmiProvider.tsx chains order `[base, mainnet]`). The FC wallet is now locked to Base for the session.
2. **The write targets mainnet.** `placeBid({ chainId: 1, address: <mainnet marketplace> })` — correct after #185.
3. **wagmi auto-attempts a chain switch.** wagmi v2's `writeContract` with a `chainId` that differs from the connector's current chain calls `connector.switchChain({ chainId: 1 })`.
4. **The farcasterFrame connector forwards `wallet_switchEthereumChain` to the Warpcast wallet provider** (`miniapp-wagmi-connector/dist/connector.js:91-104`). Whether the Warpcast FC wallet honors a switch to mainnet is **undocumented and unverified** — the SDK wallet docs say nothing about chain switching, and the Warpcast wallet is Base-first. A rejection (or silent ignore) here rejects the mutation.
5. **The failure is invisible — three ways:**
   - `handleBid`'s catch only does `alert("Failed to place bid. Please try again.")` (`useAuctionDetail.ts:833`) — **`window.alert()` is a no-op in the Warpcast miniapp webview** (native JS dialogs aren't implemented by the host), so the only error UI never renders.
   - `bidError` from `useWriteContract` is destructured (`AuctionDetailClient.tsx:178`) but **never rendered anywhere**.
   - The listing page renders **no wrong-network UI at all** — `isWrongNetwork` / `switchToRequiredChain` are computed in `useAuctionDetail` but unused by `AuctionDetailClient`. (The create flow *does* use them — `CreateAuctionClient.tsx:471-477` auto-switches on wrong network — the listing/bid flow never got the same treatment.)

Net effect: doomed write → instant rejection → `isBidding` resets → user sees nothing. Exactly "fails silently."

## How to verify (miniapp, mainnet listing)

1. Open a mainnet listing in the miniapp, remote-inspect the webview (Safari/Chrome inspector): log `useChainId()` — expect **8453** while `marketplaceReadChainId` = 1.
2. Tap Place Bid with console open — expect a rejection around `wallet_switchEthereumChain` / `SwitchChainError` from the farcasterFrame connector (the `console.error("Error placing bid:", err)` in `handleBid` will show it).
3. Directly probe wallet support: `(await sdk.wallet.getEthereumProvider()).request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] })` — if this rejects/hangs, the FC wallet cannot do mainnet, full stop.

## Proposed fixes

### A. Surface errors (regardless of wallet support — must-have)
- Replace every `alert()` in `useAuctionDetail.ts` (lines 792, 833, 1107, 1151, …) with an in-app toast/error banner — `alert` is guaranteed dead in the miniapp webview.
- Render `bidError`/`purchaseError`/`approveError` near the action buttons like the create flow does.

### B. Attempt the switch explicitly before the write
- Port the `CreateAuctionClient.tsx:471-477` pattern to the listing page: when `isWrongNetwork` becomes true (miniapp included), call `switchToRequiredChain()` and render a "Switching to Ethereum…" state. If `switchChain` errors, show it (via A).
- Consider connecting the farcasterFrame connector with an explicit `chainId` when the listing is known to be mainnet (`connect({ connector, chainId: 1 })`) so the FC wallet lands on mainnet from the start instead of Base-then-switch.

### C. If the Warpcast FC wallet turns out not to support mainnet
- Gate mainnet-listing actions in the miniapp with an explicit state: "The Farcaster wallet doesn't support Ethereum mainnet yet — open in a browser to bid" (via `sdk.actions.openUrl` / `window.open` fallback). Silent failure is the worst possible UX; an honest gate is better.
- Longer term: in-miniapp fallback connector (WalletConnect) for mainnet listings, or mirroring the marketplace on Base.

## Relevant files

- `apps/mvp/src/hooks/useAuctionDetail.ts:833` — `alert()` on bid failure (no-op in webview); `:601` placeBid writeContract
- `apps/mvp/src/app/listing/[listingId]/AuctionDetailClient.tsx:178` — `bidError` destructured, never rendered; no `isWrongNetwork`/`switchToRequiredChain` usage
- `apps/mvp/src/app/create/CreateAuctionClient.tsx:471-477` — the existing auto-switch pattern to port
- `apps/mvp/src/components/providers/WagmiProvider.tsx` — chains order `[base, mainnet]` makes farcasterFrame connect() default to Base
- `node_modules/@farcaster/miniapp-wagmi-connector/dist/connector.js:91-104` — switchChain passthrough to host wallet
- Manifest `requiredChains` already includes `eip155:1` (verified live) — this gates app install only, does nothing at runtime

## Related

- #184 — chain-context loss (fixed by #185, this is the residual miniapp-specific layer)
- #182 — connector lookup fix that unmasked this stack
