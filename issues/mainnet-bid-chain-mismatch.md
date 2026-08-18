# Bid still fails after #182 — mainnet listings reached without explicit chain context target the Base marketplace (chain-context loss between display and write)

## Context

#182 fixed the connector lookup, so miniapp users now actually connect and `handleBid` proceeds past the `isConnected` guard. This unmasked the next failure in the chain. Reporter (floar.eth): button shows brief "processing" then nothing, mobile + desktop in the FC client, FC wallet and Rabby both, no useful console output. Their clue: **the contract link on the page points to basescan** while the listing is a mainnet contract. Confirmed working case: bidding on `/listing/eth/6` in a regular desktop browser succeeds.

## Root cause A (primary): chain context is derived from the route, not the listing — and several paths lose it

The write target is decided in `useAuctionDetail.ts:251-254`:

```ts
const isExplicitEthereumListing = listingApiChainId === ETHEREUM_MAINNET_CHAIN_ID;
const marketplaceReadAddress = isExplicitEthereumListing
  ? ETHEREUM_MAINNET_MARKETPLACE_ADDRESS
  : MARKETPLACE_ADDRESS;            // Base
const marketplaceReadChainId = isExplicitEthereumListing ? mainnet.id : CHAIN_ID; // 8453
```

`listingApiChainId` is only set on `/listing/eth/[listingId]` (which hardcodes `ETHEREUM_MAINNET_CHAIN_ID`) or `?chainId=1`. On bare `/listing/[listingId]`:

1. `page.tsx` tries `resolveListingFromSubgraph(listingId)` server-side to compute the canonical path and `redirect()` to `/listing/eth/6` for mainnet listings.
2. **That redirect is fragile**: `resolveListingFromSubgraph` (`auction.ts:245`) uses raw `graphql-request` with **no timeout** (same class as #183). On a slow/erroring endpoint the `catch` falls through and the page renders with no chain context. Also, the catch's `if (!isAmbiguousListingError(e)) { /* empty */ }` body is empty — every failure mode silently falls through.
3. The page then renders `<AuctionDetailClient listingId={listingId} />` with **no `listingApiChainId`** → Base write context.
4. Meanwhile `useAuction(listingId, { chainId: undefined })` queries all subgraph endpoints, **finds and displays the mainnet listing** — the page looks perfect.
5. User clicks Bid → `placeBid({ address: <Base marketplace>, chainId: 8453, args: [6, false] })` → listing 6 doesn't exist on Base (or is a *different* listing — IDs are per-chain) → revert → "processing" for a second, then nothing.

Known link sources that produce bare `/listing/{id}` (no chain): profile page cards (documented chainId loss), homepage bids strip (static rendering, no chainId), plain shared URLs.

**Display chain ≠ write chain is the core invariant violation.** The page can render a mainnet auction while every transaction it builds targets Base.

## Root cause B (secondary): miniapp wrong-network handling is disabled

`useNetworkGuard` explicitly skips wrong-network detection in the miniapp:

```ts
const isWrongNetwork = requiredChainId != null && !authModeLoading && !isMiniApp && ...
```

The comment says "miniapp handles chain switching automatically" — it doesn't. Even with correct `/listing/eth/` context, `writeContract({ chainId: 1 })` triggers `wallet_switchEthereumChain` through the farcasterFrame connector; whether the Warpcast FC wallet honors a switch to mainnet is unverified (it may be Base-only). If it refuses, the resulting error is not surfaced anywhere the user can see. Needs verification with the FC wallet docs / a test device.

## Bug C: hardcoded basescan links on mainnet listings

- `ContractDetails.tsx:106` — accepts a `chainId` prop but hardcodes `https://basescan.org/address/...`
- `ContractDetails.tsx:174` — block link hardcoded to basescan
- `TransactionModal.tsx:76` and `lib/utils.ts:93` — tx links hardcoded to basescan

This is floar's clue, and it also means a *successful* mainnet bid would show a dead basescan tx link.

## Proposed fixes

1. **Derive the write context from the resolved auction, not the route** (kills the whole class):
   ```ts
   const effectiveChainId = listingApiChainId ?? (typeof auction?.chainId === "number" ? auction.chainId : undefined);
   const isEthereumListing = effectiveChainId === ETHEREUM_MAINNET_CHAIN_ID;
   ```
   Apply to `marketplaceReadAddress` / `marketplaceReadChainId` in `useAuctionDetail.ts`. Display chain and write chain can then never disagree.
2. **Timeout the subgraph resolve** in `resolveListingFromSubgraph` (`AbortSignal.timeout(5000)`) so the canonical redirect reliably fires instead of hanging or erroring into the Base-context fallthrough (ties into #183's fix tier B).
3. **Fix the empty catch** in `page.tsx` — distinguish ambiguity (render the picker server-side) from transient errors (log + still redirect if any endpoint answered).
4. **Chain-aware explorer links** — `ContractDetails` already receives `chainId`; pick etherscan.io vs basescan.org from it. Same for tx links in `TransactionModal` / `utils.ts`.
5. **Miniapp network guard** — don't skip wrong-network detection in miniapp; show a "switch chain" / "open in browser" prompt when requiredChain ≠ connected chain. Verify whether the Warpcast FC wallet supports mainnet at all; if not, surface "FC wallet is Base-only — use an external wallet" instead of a silent failure, and consider declaring `requiredChains` in the miniapp manifest.
6. **Emit canonical listing URLs everywhere** (use the existing `canonicalListingDetailPath` helper) from profile cards, homepage bids strip, and notification targets, so mainnet links always carry `/eth/` or `?chainId=1`.

## Repro

- Mainnet-only listing, e.g. `/listing/6` reached without chain param (profile card / bids strip / shared link) under subgraph degradation → page renders, bid reverts silently on Base.
- Verify in Vercel logs: `[Browse Listings]`/listing fetch succeeded from the mainnet endpoint while the wallet send went to chain 8453.

## Relevant files

- `apps/mvp/src/hooks/useAuctionDetail.ts:251-254` — write context from route param only
- `apps/mvp/src/app/listing/[listingId]/page.tsx:159-186` — fragile redirect, empty catch
- `apps/mvp/src/lib/server/auction.ts:245` — `resolveListingFromSubgraph`, no timeout
- `apps/mvp/src/hooks/useNetworkGuard.ts:39-44` — miniapp wrong-network detection disabled
- `apps/mvp/src/components/ContractDetails.tsx:106,174` — hardcoded basescan
- `apps/mvp/src/components/TransactionModal.tsx:76`, `apps/mvp/src/lib/utils.ts:93` — hardcoded basescan tx links
- `node_modules/@farcaster/miniapp-wagmi-connector/dist/connector.js` — `switchChain` passes through to host wallet
