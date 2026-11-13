# Relaunch overarching to-do

**Updated:** 2026-11-13  
**Policy:** No incremental merges to `main`. All-at-once relaunch when minting + Social work on the branch tip.  
**Tip:** `cursor/cloud-agent-1793668111647-jftwu` (PR [#198](https://github.com/mxjxn/cryptoart-studio/pull/198) tracks; conflicts with `main` expected)  
**Portable:** Checklist is Logseq-friendly — copy blocks into the graph later if desired.

Related:
- [Branch catch-up](./2026-11-12-branch-catchup-and-factory-status.md)
- [Studio status](./cryptoart-studio-status.md)
- [Factory runbook](./2026-11-03-all-in-factory-launch-runbook.md)
- [Preview Base Sepolia](./2026-11-12-preview-factory-deploy.md)
- [Hypersnap write-path](./2026-11-12-hypersnap-write-path.md)
- [Signer + clients (web first)](./2026-11-13-hypersnap-signer-and-clients.md)
- [Social-first layout](./2026-11-02-social-first-layout.md)

---

## How to use

- `- [ ]` = open · `- [x]` = done  
- **Owner:** `operator` (you / host secrets / broadcasts) · `agent` (repo/code) · `decide` (product call)  
- Soft items can slip past relaunch if the must-have bar says so — record that under Decisions.

---

## 1. Decisions (talk through; unlock sequencing)

- [ ] **decide** Relaunch must-haves vs nice-to-haves — does web compose (signer Phase A) block `main`, or is mint E2E + Social reads + gated compose enough?
- [ ] **decide** Studio ↔ Social v1 contract — post-mint deep links, `/compose?embed=…`, public `/c/…` share cards, “discuss this work” from management
- [ ] **decide** Feed algorithm for relaunch — keep current trending/following + curator weights + listing boosts, or a short ranking pass
- [ ] **decide** Exhibition source of truth — such.gallery vs local exhibition tables
- [ ] **decide** Web auth surface for authorize/compose — SIWE + FID directory vs imported FC/Privy login
- [ ] **decide** Cutover shape — VPS Social vs Vercel Studio; DNS; fate of `apps/mvp` on day one
- [ ] **decide** Explicit post-relaunch fence — STP, LSSVM, Clanker, notifications, native iOS/Android (tagged future in signer plan)

---

## 2. Operator — deploys, secrets, hosts

### Preview rehearsal (Base Sepolia)

- [ ] **operator** Fund deployer on Base Sepolia; set `PLATFORM_OWNER_ADDRESS`
- [ ] **operator** Run `packages/collection-contracts/script/deploy-preview-base-sepolia.sh` (or equivalent)
- [ ] **operator** Set Studio preview env: `CHAIN_84532_*` factory addresses + start blocks + RPCs
- [ ] **operator** Smoke: Studio preview → New collection on Base Sepolia → deploy
- [ ] **agent** Assist mint E2E on preview once env is live (paid pin → mint; no `.env` R/W in agent)

### Production factories (when ready — not required for Sepolia rehearsal)

- [ ] **operator** Broadcast 721+1155 factories on **Base** + verify
- [ ] **operator** Broadcast 721+1155 factories on **Ethereum** + verify
- [ ] **operator** Record via `scripts/record-factory-deployment.mjs` → fill `deployments/manifest.json`
- [ ] **operator** Set Studio + indexer prod/preview env for `CHAIN_1_*` and `CHAIN_8453_*`

### Media + data plane

- [ ] **operator** `TURBO_PRIVATE_KEY`, `X402_FACILITATOR_URL`, `CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT=false` on preview then prod
- [ ] **operator** `STORAGE_POSTGRES_URL` (and related) for Studio/indexer
- [ ] **operator** Host indexer for target `CHAIN_IDS` (84532 for preview; `1,8453` for prod)
- [ ] **operator** Run `./scripts/clean-room-reconstruction.sh` against real Postgres (not dry-only)

### Social write prerequisites

- [x] **research** Public submit host identified: **haatz** `POST https://haatz.quilibrium.com/v1/submitMessage` (no API key; see [haatz research](./2026-11-13-haatz-submit-research.md))
- [ ] **agent/operator** Set `SNAPCHAIN_SUBMIT_URL=https://haatz.quilibrium.com` on Social preview (auth unset unless policy changes)
- [ ] **operator** Cryptoart **app FID** (+ custody key in host secrets) for gasless `SignedKeyRequest`
- [ ] **decide** Keep posting via public haatz vs own node / imgnAI for SLA (haatz fine to start)

### Branch hygiene

- [ ] **agent/operator** Periodically merge/rebase `origin/main` into tip (market/auction fixes); not a partial launch
- [ ] **operator** Do **not** merge PR #198 / tip to `main` until relaunch gate is green

---

## 3. Agent / code — hard tracks (parallel where noted)

### Studio mint path

- [x] **agent** 721 + 1155 factories + Studio deploy/mint APIs (on tip)
- [x] **agent** Base Sepolia preview deploy script/docs
- [ ] **agent** Preview mint E2E once operator env is set
- [ ] **agent** Prod-shaped media path verified on preview (Turbo + real x402, mock off)

### Social compose / signer (web Phase A)

- [x] **agent** Submit client + gated `/compose` + status API
- [x] **agent** Signer plan documented (web first; native later)
- [ ] **agent** Authorize UI + gasless `KEY_ADD`
- [ ] **agent** Encrypted signer vault + `makeCastAdd` → submit
- [ ] **agent** Ungate compose when session + signer + submit URL ready

### Integration cutover prep

- [ ] **agent** Tip green against preview: Social desk + Studio mint + indexer
- [ ] **operator/agent** Single cutover checklist executed → `main` / production

---

## 4. Product refinement (parallel; soft unless promoted in §1)

### Studio mint / management polish

- [ ] **agent** Wizard + collection dashboard UX pass (errors, empty states, chain clarity Sepolia vs mainnet)
- [ ] **agent** Management page refinement (actions, status, next-steps for artists)
- [ ] **decide/agent** Studio → Social links v1 (share, discuss, embed) per §1

### Social feed / algorithm / rails

- [ ] **decide/agent** Ranking/weights review for relaunch (or explicitly freeze current policy)
- [ ] **agent** Attach → View / Buy / Bid affordances when listing present
- [ ] **agent** Empty / sparse feed states vs market rail (layout plan)
- [ ] **decide/agent** Exhibition rail source (such.gallery vs local)

### Market / desk hygiene

- [ ] **agent** Ensure `main` auction/market fixes are on tip after rebase
- [ ] **agent** Listing ↔ cast attachment polish
- [ ] **agent** Imported Farcaster tree trim/delete when desk Shell is clearly the product (cleanup)

### Explicitly later (fence)

- [ ] STP / LSSVM / Clanker
- [ ] Notifications redesign
- [ ] Native iOS / Android clients (same APIs; see signer plan Phase C)

---

## 5. Suggested order

1. Finish §1 must-have bar (short conversation).
2. Operator: Base Sepolia preview factories + Studio preview env (§2 preview).
3. Agent: mint E2E on preview; Studio polish as needed (§3 + §4 Studio).
4. Align Studio↔Social links + feed ranking freeze/pass (§1 + §4).
5. When submit URL + app FID land: signer Phase A (§3 Social).
6. Prod factories + media + indexer + clean-room (§2 prod).
7. Tip green → single cutover to `main`.

---

## 6. Logseq export hint

When moving to the graph, each `- [ ]` line can become a TODO block; keep the **Owner** tag and link back to this file / PR #198. Prefer one journal page (“Cryptoart relaunch”) with nested bullets mirroring §1–§5 rather than duplicating runbook command detail — leave commands in the linked plans.
