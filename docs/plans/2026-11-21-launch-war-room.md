# Launch War Room — relaunch live Nov 28

**Manager:** Hermes (session manager). **Updated:** 2026-11-21.
**Deadline:** live Saturday 2026-11-28. Freeze Friday 11-27 EOD.
**Policy (locked, unchanged):** no incremental merges into `main`. All-at-once cutover when minting + Social both work on branch/preview. Conflicts with `main` are expected.
**Tip:** `cursor/cloud-agent-1793668111647-jftwu` @ `18588a2f` (PR #198 tracks; #207 already merged into tip).

Canonical plan: `docs/plans/2026-11-13-relaunch-todo.md` (this file tracks the sprint, not the backlog).

---

## 1. Merge train (tip stack) — merge in this order

| # | PR | State | Gate to merge | Target day |
|---|----|-------|---------------|------------|
| 1 | #200 Lazy/Blind/Burn contracts | ready, forge 148/148 | manual Sepolia flow test after factory redeploy | Sat 21 |
| 2 | #201 Media backend (Arweave) | ready | preview upload E2E (simulated uploader OK) | Sun 22 |
| 3 | #199 Chain indexer (Vercel cron) | ready | curl cron endpoint on preview, tables populate | Sun 22 |
| 4 | #203 Studio create flows | ready, stubs resolve once #200/#201 merge | `/dev/preview` manual pass + real wallet flow on Sepolia | Mon 23 |
| 5 | #211 Desk embed dispatcher | draft | **decide**: day-one or fence | Tue 24 |
| 6 | #206 Turbo x402 direct upload | draft | review overlap with #201 media path (likely rebase) | Tue 24 |
| 7 | #210 Generative HTML NFTs | draft | **decide**: day-one or fence | Tue 24 |
| 8 | #208 Audio NFT support | draft | **decide**: day-one or fence | Tue 24 |

Not in train: #202 (PARKED by design — keep). #198 stays open as the tracking PR until cutover.

**#200 deployment note:** Base Sepolia factories run old code and MUST be redeployed after #200 merges. Do it same-day, before any Sepolia mint testing.

## 2. Manual test queue (blocking, in order)

Each item: agent preps exact commands/steps → Max executes signing steps → result recorded here.

- [ ] T1 (#200) Sepolia factories redeployed post-merge; manifest/record updated
- [ ] T2 (#200) Lazy 721 listing on Sepolia: `setMarketplaceApproval` → create listing → `setListingBaseURI` → buy → deliver mints sequential IDs; tokenURI resolves
- [ ] T3 (#200) Blind config locks on first mint; placeholder shows until reveal; airdrop URIs suppressed while blind
- [ ] T4 (#200) Burn-to-mint redeems (trailing `/` on targetBaseURI); one extension per collection
- [ ] T5 (#200) Multi-recipient airdrop CSV
- [ ] T6 (#201) Upload job on preview: quote → pay → media → metadata → confirm; `ar://` gateway retrieves; temp TTL cleanup cron fires
- [ ] T7 (#199) Preview cron: `GET /api/cron/index-events` with bearer; `chain_indexer_listings/bids/purchases` populate; factory watcher registers a new collection
- [ ] T8 (#203) `/dev/preview` walkthrough all flows, light+dark, empty states
- [ ] T9 (#203) Real wallet: deploy test collection on Sepolia → lazy mint listing end-to-end from Studio UI
- [ ] T10 (tip) Social compose on preview: authorize UI → gasless KEY_ADD (app FID needed) → cast via haatz submit
- [ ] T11 Full rehearsal: mint E2E + Social read/write + indexer all green on preview (the cutover gate)

## 3. Operator-only gates (Max — serial, start early)

- [ ] **decide** §1 must-have bar (below) — blocks everything, do today
- [ ] App FID + custody key in host secrets (blocks T10)
- [ ] `TURBO_PRIVATE_KEY` / `X402_FACILITATOR_URL` / mock-payment off — preview first, then prod (blocks real-media test)
- [ ] `STORAGE_POSTGRES_URL` on Studio/indexer preview
- [ ] DNS `cryptoart.studio` → Vercel if not resolving
- [ ] **Wed 25:** broadcast + verify 721+1155 factories on **Base** and **Ethereum**; `record-factory-deployment.mjs`; fill manifest (this is the long pole — sign during the week, not at the deadline)
- [ ] `./scripts/clean-room-reconstruction.sh` against real Postgres
- [ ] Sat 28: execute single cutover checklist

## 4. Decisions needed from Max (locked by EOD Sat 21)

1. **Must-have bar:** does web compose (signer Phase A) block cutover, or is mint E2E + Social reads + gated compose enough? (Recommend: mint E2E + Social reads mandatory; compose ungate only if T10 passes by Wed.)
2. **Day-one fence for drafts:** #208 audio, #210 generative HTML, #211 desk embeds — recommend ALL fenced past relaunch; they're nice-to-haves that eat the week.
3. **Feed algorithm:** freeze current trending/following for relaunch (recommend freeze).
4. **Exhibition source:** such.gallery vs local tables (recommend: local, defer integration).
5. **Cutover shape:** Vercel Studio + DNS apex; fate of `apps/mvp` on day one.

## 5. main-line PRs (NOT part of relaunch train)

Policy says no merges into `main` until cutover. Disposition:

| PR | Disposition |
|----|-------------|
| #196 hide ended listings, #193 explorer details | Small, green, useful day-one → **rebase onto tip**, fold into relaunch. z.ai task. |
| #197 RLS on public tables | Already applied to Supabase directly; merge to main post-cutover as record. |
| #133 fee-accounting proxy upgrade | **PARK** — proxy upgrade to the live marketplace during launch week is risk, not value. Post-relaunch. |
| #186, #178, #148, #130, #135, #142, #151, #37, #28, #26, #24, #19 | Stale (May 2025–Aug 2026). Close with a note or label `post-relaunch`; do not spend review time. |

## 6. Resource allocation

- **z.ai (cheap models, high concurrency):** rebase #196/#193 onto tip; PR-body → test-script generation; mechanical fallout fixes after each merge; stale-PR closing notes; env-var doc updates. Many small parallel tasks — this is the throughput lane.
- **Cursor composer credits:** contract-sensitive work only (#200 follow-ups, any indexer/media bugs that touch ABIs or money paths), Social signer Phase A (#208-adjacent authorize UI + KEY_ADD).
- **Hermes (this session):** manager — merge train sequencing, manual test driving (browser), prep of every operator command, fallout triage and dispatch, board updates. No key-holding, Max signs everything.

## 7. Day-by-day

| Day | Goal |
|-----|------|
| Sat 21 | Decisions §4 locked. Merge #200. Redeploy Sepolia factories. T1 starts. |
| Sun 22 | Merge #201 + #199. T6, T7. z.ai rebases #196/#193. |
| Mon 23 | Merge #203. T8 + T9. Begin real-media path once Turbo key lands. |
| Tue 24 | Drafts decided/fenced. #206 review-rebase. Signer Phase A on Cursor (T10 prep). |
| Wed 25 | **Prod factories broadcast+verify (Base+Eth), manifest filled.** Clean-room drill. T10. |
| Thu 26 | T11 full rehearsal on preview. Fallout day — z.ai concurrency on fixes. |
| Fri 27 | Freeze. Fix-only. Cutover checklist written + rehearsed dry. |
| Sat 28 | Cutover: tip → `main`, prod env, deploy, smoke. Live. |

## 8. Log

- 2026-11-21: Board created off tip `18588a2f`. All 8 stack PRs Vercel-green. CI found no failures.
