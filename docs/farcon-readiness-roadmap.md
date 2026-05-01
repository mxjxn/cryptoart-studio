# Production Readiness Roadmap
**Project:** CryptoArt MVP Auction App  
**Milestone:** Live on-stage auction readiness  
**Date:** 2026-04-30  
**Scope note:** Excludes redesign work (`/redesign`) and cache-strategy rebuild (already completed/in-flight).

---

## 1) Milestone Definition

We are “prod ready” when we can run a public live auction with confidence that:

- core auction actions complete reliably under realistic load,
- on-chain and backend state stay consistent and recoverable,
- operators can detect and resolve issues quickly during the event,
- fallback paths exist for every critical failure mode.

---

## 2) Launch Gates (Must Pass)

All gates must be green before launch.

### Gate A — Core Auction Reliability
**Owner (DRI):** Auction Reliability Lead (Backend)
- [ ] Bid placement succeeds end-to-end in normal conditions.
- [ ] Bid placement handles transient failures (RPC timeout, nonce contention, mempool delay) with clear recovery behavior.
- [ ] Auction state transitions (open/closing/closed/settled) are correct and deterministic.
- [ ] Listing pages and detail views never show impossible states (e.g., sold + open).

### Gate B — On-Chain / Off-Chain Consistency
**Owner (DRI):** Indexer/Data Integrity Lead
- [ ] Event ingestion/indexing reconciles correctly after lag/restart.
- [ ] Idempotency guaranteed for all mutation endpoints/jobs.
- [ ] Reorg/duplicate-event handling validated.
- [ ] Manual reconciliation runbook exists and has been practiced.

### Gate C — Performance & Scale
**Owner (DRI):** Performance Lead (Backend/Infra)
- [ ] Defined traffic profile load-tested (steady + burst).
- [ ] P95/P99 thresholds met for all critical endpoints and pages.
- [ ] No critical CPU/memory saturation in app/db/queue/rpc dependencies.
- [ ] Backpressure and degradation behavior documented and tested.

### Gate D — Observability & Alerting
**Owner (DRI):** SRE/Observability Lead
- [ ] Dashboards exist for user flow + system health + blockchain pipeline health.
- [ ] Alerts tuned for actionability (low noise, clear ownership).
- [ ] Error tracking includes route/context/user-safe metadata.
- [ ] Golden signals are visible in one launch dashboard.

### Gate E — Operational Readiness
**Owner (DRI):** Incident Commander (Primary)
- [ ] Incident runbooks for top failure scenarios.
- [ ] On-call rotations and escalation matrix confirmed.
- [ ] Release/rollback procedure tested from start to finish.
- [ ] Dry-run + full dress rehearsal completed with timestamped notes.

### Gate F — Security & Abuse Safety
**Owner (DRI):** Security Lead (App/Infra)
- [ ] Auth/session and privileged operations reviewed.
- [ ] Rate limits / abuse controls enforced on critical APIs.
- [ ] Dependency vulnerabilities triaged to acceptable level.
- [ ] Secrets/key-management path reviewed for launch.

---

## 3) Workstreams and Tasks

## WS1 — Auction Flow Hardening (Owner: Auction Reliability Lead)
**Goal:** Eliminate correctness regressions in bidding/closing/settlement flow.

- [ ] Map canonical state machine for auction lifecycle.
- [ ] Add/expand integration tests for edge states (late bids, ties, close boundary).
- [ ] Verify retry + idempotency behavior for mutation endpoints.
- [ ] Add user-safe error states and operator-visible root-cause context.
- [ ] Sign-off: Product + Eng + Ops.

**Definition of done:** No P1/P2 correctness bugs open; all auction lifecycle tests pass in CI + staging.

---

## WS2 — Data Integrity & Recovery (Owner: Indexer/Data Integrity Lead)
**Goal:** Ensure correctness after failures, restarts, and chain irregularities.

- [ ] Build consistency checks between DB state and chain-derived truth.
- [ ] Add replay/reconciliation script/process for missed events.
- [ ] Validate duplicate/out-of-order event handling.
- [ ] Create “break glass” manual correction procedure with approvals.
- [ ] Perform one planned recovery simulation in staging.

**Definition of done:** Recovery drill completed with documented RTO/RPO and no unresolved integrity gaps.

---

## WS3 — Performance, Capacity, and Reliability (Owner: Performance Lead)
**Goal:** Survive expected auction traffic with margin.

- [ ] Define expected peak profile (concurrent users, bid bursts, RPC throughput).
- [ ] Run load tests for browse + bid + settle critical path.
- [ ] Document bottlenecks and remediation plan.
- [ ] Add system limits and graceful degradation behavior.
- [ ] Re-test after fixes and capture final capacity envelope.

**Definition of done:** Meets agreed P95/P99 and error-rate SLOs at target load + safety margin.

---

## WS4 — UX Resilience for Live Event (Owner: Frontend Lead)
**Goal:** Keep bidder/operator confidence high during partial failures.

- [ ] Ensure deterministic loading/error/empty/syncing states in critical pages.
- [ ] Add fallback messaging for delayed chain confirmations.
- [ ] Confirm operator controls are explicit and protected.
- [ ] Verify no blocking UI dead-ends in bid flow.
- [ ] Run scripted “bad network / delayed tx” UX review.

**Definition of done:** UX QA sign-off for top 10 high-risk user journeys.

---

## WS5 — Observability & Incident Response (Owner: SRE/Observability Lead)
**Goal:** Detect issues quickly and know exactly who does what.

- [ ] Launch dashboard for: auction health, tx pipeline, API health, frontend error rate.
- [ ] Alert policy mapping: each alert -> owner -> first action.
- [ ] Add correlation IDs/tracing across frontend-api-worker boundaries.
- [ ] Define severity levels and escalation timelines.
- [ ] Conduct 30-minute incident simulation.

**Definition of done:** Team can detect + triage + assign + mitigate any critical issue in <10 minutes.

---

## WS6 — Deployment and Rollback Safety (Owner: Release Manager)
**Goal:** No risky deployment on event week/day.

- [ ] Freeze window policy and release criteria documented.
- [ ] Staging parity checklist complete.
- [ ] Rollback (or feature-flag disable) tested for critical paths.
- [ ] “Last known good” release candidate tagged.
- [ ] Change log + operator brief prepared.

**Definition of done:** Rehearsed release/rollback with verified timing and ownership.

---

## 4) Timeline (Draft)

## Week T-3
- Finalize launch gates and owners.
- Complete state-machine audit and test gap analysis.
- Stand up draft dashboards/alerts.
- Start first load test pass.

## Week T-2
- Close top correctness and integrity gaps.
- Finish reconciliation/recovery runbooks.
- Tune performance bottlenecks from first load run.
- Incident simulation #1.

## Week T-1
- Full dress rehearsal (end-to-end, timed, role-played).
- Alert tuning + final dashboard sign-off.
- Freeze non-essential changes.
- Tag release candidate.

## T-2 days to T-0
- Go/no-go review.
- Only critical fixes allowed.
- Operator briefing + comms channels checked.
- Backup plan and manual fallback prepared.

---

## 5) Go/No-Go Checklist

- [ ] All launch gates green.
- [ ] No open P0/P1 issues; explicit sign-off on any accepted risk.
- [ ] Dress rehearsal complete with documented outcomes.
- [ ] On-call + escalation matrix confirmed.
- [ ] Rollback/fallback tested and timed.
- [ ] Stakeholder go decision recorded.

---

## 6) Day-of-Auction Runbook (High Level)

## Pre-event (T-120 to T-15 min)
- [ ] Confirm app/db/worker/rpc health dashboards green.
- [ ] Verify critical endpoints and bid flow smoke tests.
- [ ] Confirm alert channels and paging paths active.
- [ ] Freeze deploys.

## Live event
- [ ] Designate incident commander, comms lead, and technical driver.
- [ ] Monitor auction flow metrics + error budgets continuously.
- [ ] Log all incidents/actions in a shared timeline.

## If degraded
- [ ] Follow severity matrix and corresponding runbook.
- [ ] Communicate status cadence every N minutes.
- [ ] Use predefined fallback path (feature flags/manual controls) as needed.

## Post-event
- [ ] Confirm settlement/completion integrity checks.
- [ ] Export incident timeline and key metrics.
- [ ] 24h postmortem with action items and owners.

---

## 7) Risk Register (Initial)

| Risk | Likelihood | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|
| Chain RPC instability during bid bursts | Med | High | Multi-provider failover, retry policy, alerts | ___ | Open |
| Event ingestion lag causing stale states | Med | High | Lag alarms, replay tooling, operator runbook | ___ | Open |
| Last-minute regressions from urgent fixes | Med | High | Freeze policy, strict RC gating, rollback drill | ___ | Open |
| Alert noise masks real incidents | High | Med | Alert tuning + severity mapping + rehearsal | ___ | Open |
| Operator confusion during live incident | Med | High | Role assignment + tabletop + comms templates | ___ | Open |

---

## 8) Ownership and Communication

- **Milestone lead:** Engineering Lead
- **Engineering lead:** Auction Reliability Lead
- **Ops lead / Incident commander backup:** SRE/Observability Lead
- **Product/stakeholder approver:** Product Lead
- **Primary war-room channel:** `#farcon-auction-war-room`
- **Escalation path:** IC -> Eng Lead -> Product Lead -> Exec Sponsor

Status cadence:
- Daily async update at 10:00 local (template: Gate status / blockers / ETA)
- Daily 15-minute launch standup at 13:00 local
- Twice-weekly readiness review (Mon/Thu) until T-1
- Final go/no-go meeting at T-2 days

### Incident Severity and Escalation Mapping

- **P0 (live auction blocked or data corruption risk):** page IC + Eng Lead immediately; start incident bridge in <= 5 minutes.
- **P1 (critical degradation with workaround):** notify IC and owning DRI immediately; mitigation plan in <= 15 minutes.
- **P2 (non-critical defect):** assign in tracker with owner and ETA in same business day.

---

## 9) Exclusions (for this milestone)

- `/redesign` endpoint feature plan
- caching strategy rebuild implementation details

(Track these separately to avoid blocking launch-readiness execution.)

---

## 10) Phase 3 Execution Checklist

Use the dedicated checklist to execute operational rehearsal and go/no-go:

- `docs/farcon-phase3-checklist.md`