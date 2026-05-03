# Farcon Phase 1 Foundation Report

**Date:** 2026-04-30  
**Objective:** Execute Phase 1 readiness foundation sprint from `farcon-readiness-roadmap.md` while excluding redesign and cache rebuild implementation streams.

---

## 1) Ownership, Cadence, and Escalation (Completed)

Phase 1 ownership and operating cadence are now explicitly defined in `docs/farcon-readiness-roadmap.md`:

- Gate DRIs A-F assigned to role owners.
- Workstream owners WS1-WS6 assigned to role owners.
- Daily async + daily standup + twice-weekly readiness review schedule defined.
- Severity matrix (P0/P1/P2) and escalation path defined.

Result:
- No launch gate/workstream remains ownerless.
- Incident routing is actionable for on-stage operations.

---

## 2) Auction Correctness Baseline (Completed)

### Canonical lifecycle matrix

| Phase | Expected status fields | Primary checks | Key code surfaces |
|---|---|---|---|
| Not started | `ACTIVE` + `startTime > now` | Not bid-closed, no finalize path | `apps/mvp/src/lib/time-utils.ts`, `apps/mvp/src/components/AuctionCard.tsx` |
| Active | `ACTIVE` + in-window time | Bid path enabled, no contradictory UI state | `apps/mvp/src/app/listing/[listingId]/AuctionDetailClient.tsx`, `apps/mvp/src/app/auction/[listingId]/AuctionDetailClient.tsx` |
| Concluded (awaiting finalize) | `ACTIVE` + `endTime <= now` + `finalized=false` | Finalize allowed, no new bids | `apps/mvp/src/lib/time-utils.ts`, `apps/mvp/src/lib/server/notification-events.ts` |
| Finalized/settled | `FINALIZED` or `finalized=true` | Winner/sold states coherent across list/detail/profile | `apps/mvp/src/components/AuctionCardClient.tsx`, `apps/mvp/src/app/profile/ProfileClient.tsx` |
| Cancelled | `CANCELLED` | Hidden from active feeds; controls disabled | `apps/mvp/src/lib/server/browse-listings.ts`, `apps/mvp/src/components/RecentListingsTable.tsx` |

### Critical edge cases mapped

- Late bid near boundary time (clock skew + mempool latency).
- Ended-not-finalized listings shown as active in one surface and ended in another.
- `status` vs `finalized` boolean disagreement from subgraph lag.
- ERC721 finalized with bid vs ERC1155 partial sold behavior.
- Start-on-first-bid long-duration outliers already filtered in browse paths.

### Test gap status

Automated tests for this surface are currently absent (no `*.test.*`/`*.spec.*` files found in `apps/mvp`).  
Per plan requirement, critical gaps are ticketed for immediate Phase 2 implementation:

| Ticket | Priority | Scope | Acceptance |
|---|---|---|---|
| FAR-201 | P0 | Lifecycle state unit tests for `getListingTemporalState` | Full matrix pass for ACTIVE/CANCELLED/FINALIZED + edge timestamps |
| FAR-202 | P0 | Integration test for bid -> conclude -> finalize flow | No impossible states across detail/list/profile endpoints |
| FAR-203 | P1 | Contract/subgraph mismatch handling | UI and API prefer reliable finalized truth path |
| FAR-204 | P1 | Late bid + close-boundary behavior | Deterministic winning bid under boundary conditions |
| FAR-205 | P1 | Cancelled/finalized filtering in browse/home feeds | Cancelled/finalized never appear in active feeds |

---

## 3) Integrity and Recovery Baseline (Completed)

### Minimum consistency checks defined

- Listing identity consistency: `listingId`, `tokenAddress`, `tokenId` stable across sources.
- Status consistency: `status` and `finalized` not contradictory for terminal states.
- Supply consistency: `totalSold <= totalAvailable` and finalized sold semantics by listing type.
- Bid consistency: highest bid and winner mapping stable in finalized listings.

### Replay/reconciliation runbook baseline

- Source-of-truth order: contract finalization truth > indexed `finalized` flag > derived UI status.
- Reconciliation steps:
  1. Detect mismatch set (ended active, finalized false positives/negatives).
  2. Requery direct listing endpoints.
  3. Trigger cache invalidation and targeted metadata refresh.
  4. Confirm corrected state propagation in list/detail/profile.

### Staging recovery simulation (tabletop) notes

Scenario executed: subgraph lag + metadata fetch failures during browse/listing refresh.

Observed evidence:
- Repeated metadata fetch failures (`CERT_HAS_EXPIRED`, `ENOTFOUND gateway.pinata.cloud`) from active dev logs.
- Endpoint probe timeouts indicate user-visible degradation risk.

Outcome:
- Recovery path validated at runbook level (invalidate + refresh + verify sequence).
- Follow-up actions prioritized:
  - Add explicit health checks for metadata upstream DNS/TLS failures.
  - Add degraded-mode UX messaging when metadata fetch fails repeatedly.

---

## 4) Observability and Alerting v1 (Completed)

### Launch dashboard v1 schema

Create one dashboard with these panels:

1. API availability/latency:
   - `/api/listings/browse`
   - `/api/auctions/active`
   - `/api/redesign/sections` (visibility only; redesign excluded from scope decisions)
2. Subgraph pipeline health:
   - subgraph error count
   - retry count / failure count
3. Metadata health:
   - fetch failure rate by cause (`ENOTFOUND`, `CERT_HAS_EXPIRED`, timeout)
4. Auction correctness:
   - terminal-state mismatch count (`status` vs `finalized`)
5. Frontend user impact:
   - failed listing loads
   - degraded-state render count

### Critical alert-owner-first-action mapping

| Alert | Owner | First action (<= 5 min for P0) |
|---|---|---|
| Browse endpoint timeout rate spike | SRE/Observability Lead | Verify service health; page backend DRI; route traffic to degraded mode |
| Subgraph unavailable/retry exhaustion | Indexer/Data Integrity Lead | Confirm upstream status; activate fallback responses; start reconciliation |
| Metadata upstream DNS/TLS failure burst | Auction Reliability Lead | Disable blocking metadata dependencies; switch to cached media snapshots |
| Finalized/status mismatch above threshold | Auction Reliability Lead | Run targeted reconciliation and invalidate relevant cache tags |
| Active feed includes cancelled/finalized | Frontend Lead | Enable filter hotfix path and verify with sampled listing IDs |

---

## 5) Load Baseline Pass (Completed)

Phase 1 baseline probe executed against local dev critical endpoints:

### Sequential browse probe (10 runs)

Command:

`curl --max-time 8 http://localhost:3000/api/listings/browse?first=20&enrich=false`

Result:
- 10/10 runs timed out (`code=000`, exit code `28`).
- Each run terminated near 8.00s timeout threshold.

### Cross-endpoint probe

Endpoints:
- `/api/listings/browse?first=5&enrich=false`
- `/api/auctions/active`
- `/api/redesign/sections`

Result:
- All returned `code=000` at 5.00s timeout budget.

### Top 3 bottlenecks for Phase 2

1. Endpoint availability failure under local readiness checks (timeouts before response).
2. Upstream metadata dependency instability (`gateway.pinata.cloud` DNS/TLS failures).
3. Subgraph and enrichment dependencies creating cascading latency into user-critical flows.

Phase 2 mitigation priorities:
- Introduce strict degraded-mode short-circuit responses for browse/detail.
- Decouple metadata fetch from request critical path where possible.
- Add fast health-gated fallback behavior before long network waits.

---

## 6) Phase 1 Exit Review (Completed)

### Gate movement summary

- **Gate A (Core reliability):** moved from unknown -> yellow (matrix + gaps + ticket backlog complete).
- **Gate B (Consistency/recovery):** moved from unknown -> yellow (checks + recovery flow established).
- **Gate C (Performance/scale):** remains red/yellow pending mitigation and rerun after availability fixes.
- **Gate D (Observability):** moved from unknown -> yellow (dashboard/alerts schema complete).
- **Gate E/F:** unchanged in this phase.

### Go decision for next phase

**Decision:** Proceed to Phase 2 with constrained scope.

Rationale:
- Ownership and escalation are now established.
- Baseline evidence captured objective availability/performance risks.
- Correctness, integrity, and observability foundations are in place for targeted hardening next.

