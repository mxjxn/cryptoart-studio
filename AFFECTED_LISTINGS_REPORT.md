# Affected Listings Report

**Generated:** 2025-12-13T03:01:05.385Z
**Total Affected:** 1

## Affected Listings

### Listing 6: 251128A

- **Seller:** 0x10e63599b39e50530f79ff574f6d50bda05b6ad4
- **Status:** ACTIVE
- **Has Bid:** true (1 bids)
- **Contract endTime:** 3530813133 (2081-11-19T21:25:33.000Z)
- **Subgraph endTime:** 1765591200 (2025-12-13T02:00:00.000Z)
- **Difference:** 20430 days
- **URL:** https://cryptoart.social/listing/6

**Issue:** Contract endTime is set way in the future (2081-11-19T21:25:33.000Z) due to the startTime=0 bug. The contract treated an absolute timestamp as a duration and added block.timestamp to it, preventing finalization.



## Root Cause

Listings created with startTime=0 (starts on first bid) that had an endTime sent as an absolute timestamp instead of a duration. When the first bid was placed, the contract added block.timestamp to the already-absolute endTime value, creating an invalid endTime far in the future.

## Impact

These listings cannot be finalized through the normal finalize() function because the contract's endTime check fails (endTime < block.timestamp is false).

## Resolution

1. Fix has been applied to prevent new listings from having this issue
2. Affected listings require manual intervention (contract upgrade or admin function) to fix
