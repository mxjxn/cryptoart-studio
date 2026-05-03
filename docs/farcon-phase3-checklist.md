# Farcon Phase 3 Checklist (Solo Mode)

**Purpose:** Solo-operator rehearsal and launch-operations readiness for live on-stage auction.  
**Scope:** Fast detection, clear fallback actions, and a confident one-person go/no-go decision.

---

## Day 1 — Command Center Setup

**Owner:** Max

Tasks:

- [ ] Finalize one command-center dashboard with:
  - browse/active latency + timeout/degraded rate
  - fallback mode distribution (`core-subgraph-only`, `last-known-good`)
  - subgraph and metadata dependency health
  - frontend user-impact indicators
- [ ] Define two threshold levels per metric:
  - `watch` (monitor closely)
  - `act-now` (immediate mitigation)
- [ ] Add a one-line first action beside each `act-now` metric.

Exit criteria:

- One dashboard gives full situational awareness.
- You can identify current system mode (normal/degraded/fallback) in under 30 seconds.

Artifact:

- `Phase3-Day1-Command-Center.md`

---

## Day 2 — Solo Runbooks (2-minute decisions)

**Owner:** Max

Tasks:

- [ ] Convert top incidents into "if X then Y" runbooks:
  - degraded spike on listing APIs
  - subgraph instability
  - metadata upstream failure
  - listing state mismatch
- [ ] Add 2-minute command blocks:
  - diagnose
  - apply mitigation
  - verify recovery
- [ ] Add a stop condition per runbook ("if not recovered in N minutes, switch to safe mode").

Exit criteria:

- You can execute any critical runbook without decision ambiguity.
- Each runbook has one clear first action and one clear stop condition.

Artifact:

- `Phase3-Day2-Solo-Runbook-Pack.md`

---

## Day 3 — Chaos Drill (Solo)

**Owner:** Max

Tasks:

- [ ] Run one controlled chaos drill for timeout/degraded behavior.
- [ ] Validate:
  - APIs stay bounded (no hanging requests),
  - fallback behavior is observable in metrics/logs,
  - operators can identify current fallback mode quickly.
- [ ] Time detection + mitigation windows.
- [ ] Write one "what surprised me" note and fix the runbook immediately.

Exit criteria:

- Critical issue detected and mitigated in <= 10 minutes.
- No step during mitigation requires improvisation.

Artifact:

- `Phase3-Day3-Solo-Chaos-Report.md` with timestamps.

---

## Day 4 — Full Dress Rehearsal (One-person timeline)

**Owner:** Max

Tasks:

- [ ] Simulate full event timeline:
  - preflight checks
  - live traffic window
  - injected degradation event
  - recovery + post-event checks
- [ ] Log all actions and decisions with timestamps.
- [ ] Timebox all critical interventions (target <= 2 minutes to first mitigation).

Exit criteria:

- You can execute full event flow alone without losing situational awareness.
- Recovery actions are repeatable and fast.

Artifact:

- `Phase3-Day4-Solo-Dress-Rehearsal.md`

---

## Day 5 — Go/No-Go Review

**Owner:** Max

Tasks:

- [ ] Score each launch gate A-F as Green / Yellow / Red.
- [ ] List blocking issues and accepted risks explicitly.
- [ ] Decide go/no-go with a single written decision note.

Exit criteria:

- Decision is documented and unambiguous.
- If no-go, next 72-hour remediation list is defined.

Artifact:

- `Phase3-Day5-Solo-GoNoGo-Scorecard.md`

---

## Gate Scoring Template

Use this template in Day 5 scorecard:

| Gate | Status | Evidence | Owner | Blockers | Decision Notes |
| --- | --- | --- | --- | --- | --- |
| Gate A — Core Auction Reliability | ___ | ___ | Max | ___ | ___ |
| Gate B — On/Off-chain Consistency | ___ | ___ | Max | ___ | ___ |
| Gate C — Performance & Scale | ___ | ___ | Max | ___ | ___ |
| Gate D — Observability & Alerting | ___ | ___ | Max | ___ | ___ |
| Gate E — Operational Readiness | ___ | ___ | Max | ___ | ___ |
| Gate F — Security & Abuse Safety | ___ | ___ | Max | ___ | ___ |

---

## Minimum Phase 3 Completion Bar

- [ ] One successful chaos drill completed and documented.
- [ ] One full dress rehearsal completed and documented.
- [ ] Detection + triage time for critical failures at or below target.
- [ ] Gate scorecard completed with a solo go/no-go decision note.

---

## 10-Minute Pre-Show Checklist (Solo)

- [ ] Dashboard open and healthy baseline confirmed.
- [ ] Primary runbook file open in editor.
- [ ] Last fallback status check completed (`normal` vs `degraded` vs `lkg`).
- [ ] "Act-now" thresholds reviewed for the show window.
- [ ] Go/no-go decision recorded before start.
