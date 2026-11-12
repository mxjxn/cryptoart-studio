# Branch catch-up + factory deploy status

**Updated:** 2026-11-12  
**Operator deploy work since 2026-11-03:** none (confirmed). Base + Ethereum factory addresses remain `null`.

---

## Where we are (branch stack)

You are on a **branch of a branch**. Tips as of fetch:

| Ref | Tip | Notes |
|-----|-----|-------|
| `origin/main` | `ed976125` | Latest production line. Includes auction poll fix (#194) and market hang fix (#195) after our merge-base. |
| `origin/feat/social-web-foundation` | `853ca747` | Social-first desk + Hypersnap feed. **Not merged to main.** No open PR. |
| `origin/feat/social-studio-integration` | `853ca747` | Same tip as social-web-foundation (identical). Fork point for Studio work. **No open PR.** |
| `cursor/cloud-agent-1793668111647-jftwu` (this branch) | `7dd47a9a` | = social tip + Studio wizard/UI (`72bf4cb5`) + all-in 721/1155 factory path (`7dd47a9a`). |
| PR [#198](https://github.com/mxjxn/cryptoart-studio/pull/198) | open → `main` | **CONFLICTING.** ~3624 files / huge social+studio stack retargeted at main. |

```text
origin/main (ed976125)
    │
    │  (diverged — 3 commits ahead of merge-base 1cfec539)
    │
    └── feat/social-web-foundation  ─┐
        feat/social-studio-integration ├─ both at 853ca747
                                       │
                                       ├─ 72bf4cb5  Studio UI/drafts/wizard (cloud apply)
                                       └─ 7dd47a9a  All-in factory launch (PR #198 tip)
```

**Implication:** PR #198 is not a thin factory PR. Merging it into `main` as-is would drag the entire unmerged Social desk + Studio UI stack with it, and it already conflicts with `main`.

---

## What landed in code (this tip) — not yet on main

### Social (parent tip `853ca747`)
- Social-first desk, Hypersnap trending/following mix, curated rails
- Docs for Social product / layout plans

### Studio UI (`72bf4cb5`)
- Deploy wizard (Chain → Standard → Name → Royalties → Branding → Deploy)
- Collection dashboard, single mint + series pages, public `/c/...` pages
- Drafts API + `collection_drafts` migration `0027`
- Standard choice: **1/1s → ERC-721** or **multi-supply → ERC-1155** (not numbered editions)
- Royalty toggle UI fixed; metadata “best practices” step removed

### Factory / media / indexer (`7dd47a9a`)
- `SuchCollection1155` + `SuchCollection1155Factory` (limited or open supply)
- `DeployFactory.s.sol` deploys **both** factories
- Indexer multi-factory env: `CHAIN_{id}_FACTORY_ADDRESS` + `CHAIN_{id}_ERC1155_FACTORY_ADDRESS`
- `TransferSingle` / `TransferBatch` indexing; `collections.token_standard`
- Migrations `0028` (token standard), `0029` (arweave_records)
- Prod media wiring: Turbo required, mock pay off in prod, HTTP facilitator
- Studio deploy/mint APIs for both standards; mint uses confirmed `ar://` URI
- Local proofs: anvil E2E, media job E2E, indexer config tests
- Checked-in manifest + runbook (addresses for Base/Eth still null)

---

## Operator deploy status (nothing broadcast)

| Gate | Status |
|------|--------|
| Forge tests / anvil E2E | Done in agent session (Nov 3) |
| Media job machine tests | Done (sim/mock) |
| Base factory 721+1155 | **Not deployed** |
| Ethereum factory 721+1155 | **Not deployed** |
| Explorer verify | **Not done** |
| `deployments/manifest.json` Base/Eth filled | **Still null** |
| Studio/indexer prod env | **Not set** |
| Clean-room Postgres drill | Dry-validation only (no `STORAGE_POSTGRES_URL` in agent) |
| cryptoart.studio production cutover | **Blocked** on factories + Arweave prod secrets |

Canonical operator steps: [2026-11-03-all-in-factory-launch-runbook.md](./2026-11-03-all-in-factory-launch-runbook.md) and [packages/collection-contracts/deployments/README.md](../../packages/collection-contracts/deployments/README.md).

---

## Release policy (locked Nov 12)

**Do not merge incrementally into `main`.** Relaunch is all-at-once: Social + Studio minting + factories + write path must work on the branch (preview / test deploys) before anything lands on `main`.

- Work and test-deploy from this stacked tip (and child branches if needed).
- PR #198 may stay open as a tracking PR; treat conflicts with `main` as expected until cutover.
- Periodically **rebase or merge `origin/main` into the tip** so market/auction fixes stay available — that is integration hygiene, not a partial launch.

## Recommended sequencing (on-branch)

1. Keep building on `cursor/cloud-agent-1793668111647-jftwu` (or a branch off it).
2. Studio path: operator broadcast Base+Eth factories when ready; wire env on preview; finish Arweave prod + mint E2E on the branch.
3. Social path: choose cast write model (app-held gasless signer vs user-signed); wire compose against a writable Snapchain submit; keep Hypersnap HTTP for reads.
4. Full relaunch gate: minting + new Social both working on branch previews → then single cutover to `main` / production.

---

## Paste for a new session

> Catch-up: tip `cursor/cloud-agent-1793668111647-jftwu` stacks Social + Studio + factory launch. **No incremental merges to `main`** — all-at-once relaunch when minting + Social work on branch. PR #198 tracks the tip; conflicts with main are expected. **No Base/Eth factories deployed.** Read `docs/plans/2026-11-12-branch-catchup-and-factory-status.md`.
