# Affected Listings Report

**Generated:** 2025-12-13T03:04:46.410Z
**Total Affected (Bug Triggered):** 1
**Total At-Risk (Bug Present):** 2

## Affected Listings (Bug Already Triggered)

These listings have received bids, causing the bug to trigger. The contract endTime is now way in the future, preventing finalization.

### Listing 6: 251128A

- **Seller:** 0x10e63599b39e50530f79ff574f6d50bda05b6ad4
- **Status:** ACTIVE
- **Has Bid:** true (1 bids)
- **Contract endTime:** 3530813133 (2081-11-19T21:25:33.000Z)
- **Subgraph endTime:** 1765591200 (2025-12-13T02:00:00.000Z)
- **Difference:** 20430 days
- **URL:** https://cryptoart.social/listing/6

**Issue:** Contract endTime is set way in the future (2081-11-19T21:25:33.000Z) due to the startTime=0 bug. The contract treated an absolute timestamp as a duration and added block.timestamp to it, preventing finalization.



## At-Risk Listings (Bug Present But Not Triggered)

These listings haven't received bids yet, but they have the bug present. Once the first bid is placed, the contract will incorrectly add block.timestamp to the already-absolute endTime value.

### Listing 7: 251027A

- **Seller:** 0x10e63599b39e50530f79ff574f6d50bda05b6ad4
- **Status:** ACTIVE
- **Has Bid:** false (0 bids)
- **Subgraph endTime:** 1765308617 (2025-12-09T19:30:17.000Z)
- **Days until subgraph endTime:** -4 days
- **⚠️ If first bid placed now, contract endTime would become:** 2081 (2081-11-20T22:34:19.000Z)
- **URL:** https://cryptoart.social/listing/7

**Issue:** Listing has startTime=0 with an absolute endTime timestamp. When the first bid is placed, the contract will add block.timestamp to this value, creating an invalid endTime way in the future.


### Listing 8: 251129A

- **Seller:** 0x10e63599b39e50530f79ff574f6d50bda05b6ad4
- **Status:** ACTIVE
- **Has Bid:** false (0 bids)
- **Subgraph endTime:** 1765309032 (2025-12-09T19:37:12.000Z)
- **Days until subgraph endTime:** -4 days
- **⚠️ If first bid placed now, contract endTime would become:** 2081 (2081-11-20T22:41:14.000Z)
- **URL:** https://cryptoart.social/listing/8

**Issue:** Listing has startTime=0 with an absolute endTime timestamp. When the first bid is placed, the contract will add block.timestamp to this value, creating an invalid endTime way in the future.



## Root Cause

Listings created with startTime=0 (starts on first bid) that had an endTime sent as an absolute timestamp instead of a duration. When the first bid was placed, the contract added block.timestamp to the already-absolute endTime value, creating an invalid endTime far in the future.

## Impact

These listings cannot be finalized through the normal finalize() function because the contract's endTime check fails (endTime < block.timestamp is false).

## Resolution

1. Fix has been applied to prevent new listings from having this issue
2. Affected listings require manual intervention (contract upgrade or admin function) to fix
