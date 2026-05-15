# Auction end time extends by full duration on every bid

## Summary

For auctions created with `startTime = 0` (start on first bid), the displayed end time extends by the full auction duration (e.g., 7 days) every time a new bid is placed. The on-chain end time is correct and does not change — this is a **frontend display bug** caused by recalculating `actualEndTime` using the highest bid's timestamp instead of the first bid's timestamp.

## Reproduction

1. Create an auction listing with "start on first bid" (startTime = 0) and a 7-day duration
2. First bid comes in at time T → displayed end time correctly shows T + 7 days
3. Second bid comes in at time T+1 → displayed end time shifts to (T+1) + 7 days
4. Every subsequent bid shifts the displayed end time forward

On-chain, the contract correctly converts `endTime` to an absolute timestamp on the first bid and never changes it again (since `extensionInterval = 0`). The actual auction ends on-chain at the correct time. Only the frontend display is wrong.

## Root Cause

### The contract (correct behavior)

In `SettlementLib.sol`, `_preBidCheck()` lines 93-97:

```solidity
// If startTime is 0, start on first purchase
if (listing.details.startTime == 0) {
    listing.details.startTime = uint48(block.timestamp);
    listing.details.endTime += uint48(block.timestamp);
}
```

This runs **only once** (on the first bid, when `startTime` is still 0). After that, `startTime > 0` so subsequent bids skip this block. The `_postBidExtension()` also skips because `extensionInterval = 0`. So the on-chain `endTime` is set correctly and never changes.

### The subgraph (stores raw values)

The subgraph indexes `ListingCreated` and stores the raw `startTime = 0` and `endTime = 604800` (the duration). The contract's internal update to `startTime`/`endTime` on the first bid does **not** emit a `ModifyListing` event, so the subgraph never learns about the conversion from duration → absolute timestamp.

### The frontend hook (the bug)

In `useAuctionDetail.ts`, lines 1746-1757, when `startTime === 0` and the auction has started:

```typescript
if (endTime > YEAR_2000_TIMESTAMP) {
  actualEndTime = endTime;  // already absolute — use as-is
} else {
  // endTime is still a DURATION from the subgraph
  const auctionStartTimestamp = auction?.highestBid?.timestamp
    ? parseInt(auction.highestBid.timestamp)  // ← BUG: uses HIGHEST bid, not FIRST bid
    : now;
  actualEndTime = auctionStartTimestamp + endTime;
}
```

`highestBid.timestamp` is the timestamp of the **current highest bid** (most recent winning bid), not the **first** bid. So each new out-bid updates `highestBid.timestamp`, which recalculates `actualEndTime = newBidTimestamp + 604800`, shifting the displayed end time forward by up to the full duration.

## Fix Options

### Option A: Query the contract for the real `endTime` (best)

After the auction has started, read `startTime` and `endTime` directly from the contract via `getListing()` instead of using the subgraph's stale values. The contract has the correct absolute timestamps after the first bid.

The hook already fetches `listingData` from the contract (line 1773: `listingData?.details?.endTime`). Use this for `actualEndTime` calculation when available, falling back to the duration math only when contract data isn't loaded yet.

### Option B: Store the first bid timestamp

Add a `firstBidTimestamp` field to the subgraph or API response. Use this instead of `highestBid.timestamp` for the duration calculation. This requires either a subgraph schema change or an API join.

### Option C: Use the contract's `startTime` for duration calculation

When the contract `listingData` is available, use `listingData.details.startTime` (which is set on first bid) instead of `highestBid.timestamp`:

```typescript
const auctionStartTimestamp = listingData?.details?.startTime
  ? Number(listingData.details.startTime)
  : auction?.highestBid?.timestamp
    ? parseInt(auction.highestBid.timestamp)
    : now;
actualEndTime = auctionStartTimestamp + endTime;
```

### Recommended: Option A

The contract is the source of truth for `endTime` after the first bid. The hook already fetches contract data — it just doesn't use it in the `actualEndTime` calculation for the `startTime === 0` path. Fix the `actualEndTime` computation to prefer contract data over subgraph data.

## Relevant Files

- `apps/mvp/src/hooks/useAuctionDetail.ts` — lines 1745-1762 (`actualEndTime` calculation)
- `packages/auctionhouse-subgraph/src/auctionhouse.ts` — stores raw `endTime` from creation event
- Contract: `SettlementLib.sol` — `_preBidCheck()` converts duration to absolute on first bid
- Contract: `SettlementLib.sol` — `_postBidExtension()` only extends when `extensionInterval > 0`

## Impact

- **User-facing:** Bidders see the auction end time jump forward on every bid, which is confusing and may discourage bidding
- **Functional:** The auction still ends at the correct on-chain time. Frontend display may briefly show the auction as "active" after it has actually ended on-chain, until the next data refresh
- **Severity:** Medium — incorrect display but correct on-chain behavior
