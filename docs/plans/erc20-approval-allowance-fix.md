# ERC-20 Purchase Flow Bugs

Three related bugs in ERC-20 listings, all surfaced after the decimal fix (PR #144).

---

## Bug 1: "Transfer amount exceeds allowance" (contract + frontend)

### Problem

The user approves the exact `totalPrice` (listing price × quantity), but the contract's `transferFrom` tries to pull **more** because marketplace fees, referrer cuts, and royalties are deducted via **separate `transferFrom` calls** from the buyer's wallet.

### Root Cause

In `SettlementLib.sol`, `performPurchase()` calls `receiveTokens()` once for the listing price:

```solidity
// Line 280 — pulls `totalPrice` from buyer to contract
require(IERC20(listing.details.erc20).transferFrom(source, address(this), amount));
```

Then `_paySeller()` is called with `source = msg.sender` (the buyer). It makes **additional `transferFrom` calls**:

1. **Marketplace fee** (line 457): `receiveTokens(listing, source, marketplaceAmount)` → `transferFrom(buyer, ...)`
2. **Referrer cut** (line 466): `sendTokens(erc20, source, referrer, referrerAmount)` → `transferFrom(buyer, ...)`
3. **Royalties** (line 477): `sendTokens(erc20, source, recipient, amounts[i])` → `transferFrom(buyer, ...)`
4. **Seller proceeds** (line 484): `sendTokens(erc20, source, seller, sellerAmount)` → `transferFrom(buyer, ...)`

Total pulled: `totalPrice + marketplaceFee + referrerFee + royalties`
But frontend approves only: `totalPrice`

Example: 100 USDC listing, 2.5% marketplace, 1% referrer → approved 100, contract pulls 103.5.

ETH works fine because `msg.value` covers everything in one tx and the contract distributes internally.

The old `parseEther` bug inflated approvals by 10^12, masking this completely.

### Fix

**Contract (`SettlementLib.sol`):** Change `performPurchase()` line 79 — for ERC-20, pass `address(this)` instead of `msg.sender` to `_paySeller`. The initial `receiveTokens` already pulls `totalPrice` to the contract; distribute from contract balance instead of pulling again from the buyer.

```solidity
// Line 76-80: Change ERC-20 source to address(this)
if (listing.details.erc20 == address(0)) {
    _paySeller(..., address(this), totalPrice, ...);
} else {
    _paySeller(..., address(this), totalPrice, ...);  // <-- was msg.sender
}
```

Verify `sendTokens()` uses `transfer` (from contract) when `source == address(this)`, which it already does (line 294).

**Frontend (temporary):** As a stopgap, approve `max uint256` so users can transact immediately.

---

## Bug 2: No separate "Approve" button (frontend UX)

### Problem

Users see only a "Buy Now" button. There's no explicit "Approve {token}" step. The approve is hidden inside the purchase handler — clicking "Buy Now" sends an approval tx, returns, and relies on a `useEffect` to auto-purchase after the approval confirms.

### Root Cause

In `useAuctionDetail.ts` lines 837-851 and `AuctionDetailClient.tsx` lines 505-524:

```typescript
if (!currentAllowance || currentAllowance < totalPrice) {
    setPendingPurchaseAfterApproval(true);  // Set flag
    await approveERC20({...});              // Send approve tx
    return;                                 // Return without purchasing
}
```

Then a `useEffect` (lines 895-956) watches for `isApproveConfirmed` and auto-triggers the purchase:

```typescript
useEffect(() => {
    if (isApproveConfirmed && pendingPurchaseAfterApproval && ...) {
        refetchAllowance().then(() => {
            setTimeout(() => {         // 1-second race condition
                purchaseListing({...});
            }, 1000);
        });
    }
}, [isApproveConfirmed, pendingPurchaseAfterApproval, ...]);
```

### Problems with this approach

1. **Misleading UX**: Button says "Buy Now" but sends an approval tx. Small yellow text says *"Click 'Buy Now' to approve"* — confusing.
2. **Fragile auto-trigger**: If component re-renders or unmounts during the 1-second `setTimeout`, the purchase never fires.
3. **No error recovery**: If auto-purchase fails, user is stuck with approved tokens but no purchase. Must click again.
4. **Non-standard**: OpenSea, Blur, etc. all show a distinct "Approve" step before the purchase button becomes active.

### Fix

**Two distinct button states:**

```
If allowance < totalPrice:
    Show "Approve {token}" button (sends approve tx)
    
If allowance >= totalPrice:
    Show "Buy Now" button (sends purchase tx)
```

**Files to change:**
- `apps/mvp/src/hooks/useAuctionDetail.ts` — expose `needsApproval` boolean
- `apps/mvp/src/app/auction/[listingId]/AuctionDetailClient.tsx` — separate approve/purchase buttons
- `apps/mvp/src/app/listing/[listingId]/AuctionDetailClient.tsx` — same
- Remove the `pendingPurchaseAfterApproval` useEffect pattern

---

## Bug 3: "0 out of 11 available" — stale availability display (frontend data source)

### Problem

Listings show "0 of 11 available" even for the first purchaser, making items appear sold out when they aren't.

### Root Cause

The availability display relies on **subgraph data**, not on-chain contract state.

Frontend display (`AuctionDetailClient.tsx` lines 1747-1750):
```typescript
const totalAvailable = parseInt(auction.totalAvailable || "0");
const totalSold = parseInt(auction.totalSold || "0");
const remaining = Math.max(0, totalAvailable - totalSold);
```

This reads from `auction` which comes from the API → subgraph. The contract's actual state (already fetched via `useReadContract` at line 658) is **only used for debug info**, not for the availability display.

Evidence this is a known issue:
- Line 1754: `const showDebug = listingId === "11" || totalAvailable === 0 || isNaN(totalAvailable);` — hard-coded debug display for listing #11, indicating they've seen this problem before.

The subgraph can lag or index incorrectly:
- 2-minute API cache (`route.ts` revalidate: 120) serves stale data
- If `handlePurchaseEvent` fires before `handleCreateListing` in the subgraph, `totalSold` can be miscalculated
- Subgraph `getOrCreateListing` creates listings with `totalPerSale = 0` as default — if purchase events arrive first, `totalSold = count * 0 = 0`, then `totalAvailable` gets set correctly later but the math is already wrong

### Fix

**Use on-chain `listingData` (already fetched) as source of truth for availability.**

The frontend already reads `getListing` from the contract (line 658-664). Use `listingData.totalSold` and `listingData.details.totalAvailable` for the availability display instead of the subgraph-derived `auction.totalSold` / `auction.totalAvailable`.

**Files to change:**
- `apps/mvp/src/app/auction/[listingId]/AuctionDetailClient.tsx` — compute `remaining` from `listingData` (on-chain) instead of `auction` (subgraph)
- `apps/mvp/src/app/listing/[listingId]/AuctionDetailClient.tsx` — same
- Fall back to subgraph data only if on-chain read hasn't completed yet

---

## Implementation Priority

1. **Bug 1 contract fix** — change `_paySeller` source to `address(this)` for ERC-20 (proper architecture fix)
2. **Bug 2 UX fix** — separate approve/purchase buttons (unblocks users, removes race condition)
3. **Bug 3 data source fix** — use on-chain data for availability (stops showing incorrect stock)
4. **Bug 1 frontend temp** — approve max uint256 as temporary patch if contract fix is delayed

## Files Summary

### Contract
- `packages/auctionhouse-contracts/src/libs/SettlementLib.sol`
  - `performPurchase()`: Change ERC-20 `_paySeller` source to `address(this)`
  - Verify `sendTokens()` handles `source == address(this)` correctly (it does — line 294 uses `transfer`)

### Frontend
- `apps/mvp/src/hooks/useAuctionDetail.ts` — approval amount, expose `needsApproval`, remove auto-purchase useEffect
- `apps/mvp/src/app/auction/[listingId]/AuctionDetailClient.tsx` — separate approve/buy buttons, use on-chain availability
- `apps/mvp/src/app/listing/[listingId]/AuctionDetailClient.tsx` — same
