# ERC-20 Approval Amount Bug: "Transfer amount exceeds allowance"

## Problem

After the ERC-20 decimal fix (PR #144), buying ERC-20 listings fails with:

```
ERC20: transfer amount exceeds allowance
```

The user approves the exact `totalPrice` (listing price × quantity), but the contract's `transferFrom` tries to pull **more** than that amount because marketplace fees, referrer cuts, and royalties are all deducted via **separate `transferFrom` calls** from the buyer's wallet.

## Root Cause

### How the purchase flow works (ERC-20 path)

In `SettlementLib.sol`, `performPurchase()` calls `receiveTokens()` once for the listing price:

```solidity
// Line 280 — pulls `totalPrice` from buyer
require(IERC20(listing.details.erc20).transferFrom(source, address(this), amount));
```

Then `_paySeller()` is called with `source = msg.sender` (the buyer). It makes **additional `transferFrom` calls** from the buyer:

1. **Marketplace fee** (line 457): `receiveTokens(listing, source, marketplaceAmount, ...)` → `transferFrom(buyer, marketplace, marketplaceAmount)`
2. **Referrer cut** (line 466): `sendTokens(erc20, source, referrer, referrerAmount)` → `transferFrom(buyer, referrer, referrerAmount)`
3. **Royalties** (line 477): `sendTokens(erc20, source, recipient, amounts[i])` → `transferFrom(buyer, royaltyRecipient, amounts[i])`
4. **Seller proceeds** (line 484 via `distributeProceeds`): `sendTokens(erc20, source, seller, sellerAmount)` → `transferFrom(buyer, seller, sellerAmount)`

### The math

The total pulled from the buyer is:
```
totalPulled = totalPrice + marketplaceFee + referrerFee + royalties
```

But the frontend only approves `totalPrice`:
```typescript
// useAuctionDetail.ts line 848
args: [marketplaceReadAddress, totalPrice],
```

So if a listing costs 100 USDC, marketplaceBPS is 250 (2.5%), and referrerBPS is 100 (1%):
- Approved: **100 USDC**
- Contract tries to pull: **100 + 2.5 + 1.0 = 103.5 USDC**
- Result: ❌ "transfer amount exceeds allowance"

### Why ETH listings work fine

For ETH, the buyer sends `msg.value == totalPrice` in a single tx. The contract holds the funds and distributes internally — no approval needed.

### Why the old `parseEther` code "worked"

Before the decimal fix, listings created with USDC (6 decimals) were using `parseEther` (18 decimals), so prices were inflated by 10^12. The approval amount was astronomically large, masking the shortfall from fees.

## Affected Code

### Contract side (`SettlementLib.sol`)
- `performPurchase()` line 280: pulls `totalPrice` from buyer to contract
- `_paySeller()` line 452-485: pulls fees + royalties + seller proceeds from buyer via additional `transferFrom` calls
- For ERC-20, `source = msg.sender` (buyer), not `address(this)`

### Frontend side
- `apps/mvp/src/hooks/useAuctionDetail.ts` lines 841-848: approves only `totalPrice`
- Same pattern at lines 789, 968 for offers/bids
- `apps/mvp/src/app/auction/[listingId]/AuctionDetailClient.tsx` lines 440-447, 511-520: same pattern

## Fix Options

### Option A: Approve with buffer (frontend fix — quickest)
Add the maximum possible fee overhead to the approval amount:
```typescript
const maxFees = totalPrice * BigInt(marketplaceBPS + referrerBPS + maxRoyaltyBPS) / BigInt(10000);
const approveAmount = totalPrice + maxFees;
```
Or simply approve `type(uint256).max` for a smoother UX (common pattern — Uniswap, OpenSea do this).

**Pros:** No contract changes, no redeployment
**Cons:** Over-approving is a security tradeoff

### Option B: Fix contract to pull once, distribute internally (contract fix — proper)
Change `_paySeller` for ERC-20 to use `address(this)` as source (like the ETH path already does). The initial `receiveTokens` in `performPurchase` already pulls `totalPrice` to the contract. Then `_paySeller` distributes from the contract's balance instead of making additional `transferFrom` calls from the buyer.

```solidity
// In performPurchase, for ERC-20, always use address(this) as source for _paySeller
if (listing.details.erc20 == address(0)) {
    _paySeller(royaltyEngineV1, listing, address(this), totalPrice, ...);
} else {
    // Pull full amount to contract first (already done above)
    // Then distribute from contract balance
    _paySeller(royaltyEngineV1, listing, address(this), totalPrice, ...);  // <-- change source to address(this)
}
```

This matches how ETH already works and avoids the double-pull problem entirely.

**Pros:** Correct architecture, single approval for exact price, matches ETH flow
**Cons:** Requires contract upgrade/redeployment

### Option C: Pull total once, accounting in contract (hybrid)
Add up all fees first, do a single `transferFrom(buyer, contract, totalPrice + allFees)`, then distribute from contract balance.

## Recommendation

**Option B** is the right fix — it aligns ERC-20 flow with the ETH flow. The contract already receives tokens via `receiveTokens` at line 280; `_paySeller` should distribute from `address(this)` instead of pulling again from `msg.sender`.

As a **temporary frontend patch**, approve `max uint256` (or a generous buffer) so users can transact immediately while the contract fix is prepared.

## Files to Change

### Contract
- `packages/auctionhouse-contracts/src/libs/SettlementLib.sol`
  - `performPurchase()`: Change ERC-20 `_paySeller` source from `msg.sender` to `address(this)`
  - Verify `sendTokens()` uses `transfer` (from contract) when `source == address(this)`, not `transferFrom`

### Frontend (temporary or permanent)
- `apps/mvp/src/hooks/useAuctionDetail.ts` — approval amount in `handlePurchase`, `handleBid`, `handleMakeOffer`
- `apps/mvp/src/app/auction/[listingId]/AuctionDetailClient.tsx` — same
