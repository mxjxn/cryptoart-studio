# cryptoart.studio — compact status

**Updated:** 2026-11-13  
**Full spec:** [2026-06-cryptoart-studio.md](./2026-06-cryptoart-studio.md)  
**Overarching to-do:** [2026-11-13-relaunch-todo.md](./2026-11-13-relaunch-todo.md)  
**Branch catch-up:** [2026-11-12-branch-catchup-and-factory-status.md](./2026-11-12-branch-catchup-and-factory-status.md)  
**Factory runbook:** [2026-11-03-all-in-factory-launch-runbook.md](./2026-11-03-all-in-factory-launch-runbook.md)  
**Project board:** [cryptoart.studio](https://github.com/users/mxjxn/projects/2) · issues `#159`–`#168`

---

## What it is

Artist dashboard at **cryptoart.studio** (`apps/studio`) — deploy collections, mint, manage. **cryptoart.social** stays social/marketplace; listing UI on Studio is **Stage B**.

---

## Locked decisions (Stage A)

- **Storage:** Arweave (artist pays). IPFS BYO = Stage C.
- **Drafts:** server-side; retain pinned Arweave URIs on resume.
- **Series:** separate 2-page wizard; strict zip; no hard batch cap (soft gas hints).
- **Volume column:** `—` until listings.
- **Public pages:** yes (`/c/[chainId]/[address]/…`).
- **Royalties:** 10% default, opt-out only.
- **Chains:** Base + Ethereum (all-in; no Base-only soft launch).
- **API home:** `apps/studio` (moved from mvp).
- **Collection type (Nov 2):** never a single-artwork-only contract. Deploy choice is **1/1s → ERC-721** or **multi-supply → ERC-1155**. 1155 = limited or open supply — not numbered editions.
- **Launch bar (Nov 3):** no production main until 721+1155 factories live on Base+Eth, Turbo Arweave + real x402, Studio mint/deploy E2E, indexer clean-room green.

---

## Branch reality (Nov 12)

| Layer | Ref | On `main`? |
|-------|-----|------------|
| Social-first desk | `feat/social-web-foundation` = `feat/social-studio-integration` @ `853ca747` | No |
| Studio wizard/UI + drafts | `72bf4cb5` on cloud tip | No |
| 721/1155 factories + media/indexer wiring | `7dd47a9a` (PR [#198](https://github.com/mxjxn/cryptoart-studio/pull/198)) | No — PR conflicts with `main` |
| Market/auction fixes | `main` @ `ed976125` (#194, #195) | Yes |

`main` does **not** have Social desk or the factory work. Operator has **not** deployed Base/Eth factories.

---

## Done (code — on cloud tip, not main)

| Layer | Status |
|-------|--------|
| Spec + issues + project | ✅ |
| ERC-721 `SuchCollection` + factory | ✅ (Sepolia historically; mainnet addresses unset) |
| ERC-1155 `SuchCollection1155` + factory | ✅ code + anvil E2E |
| Indexer multi-factory + 1155 transfer events | ✅ |
| DB `0023` collections + `0027` drafts + `0028` token_standard + `0029` arweave_records | ✅ migrations on tip |
| Collections API in `apps/studio` | ✅ |
| Deploy wizard + mint wizard (paid pin → mint) | ✅ on tip |
| Prod media defaults (Turbo / mock-off / facilitator) | ✅ code path |
| Base + Ethereum factory broadcast + verify | ❌ not done |
| Manifest Base/Eth addresses | ❌ still `null` |
| Hosted indexer + clean-room against real Postgres | ❌ |

---

## Release policy (locked Nov 12)

**No incremental merges to `main`.** Ship Social + Studio minting + factories together at relaunch. Until then: develop and test-deploy from the stacked branch tip. Periodically merge/rebase `origin/main` into the tip for hygiene only.

## Next (on-branch)

Canonical checklist: **[2026-11-13-relaunch-todo.md](./2026-11-13-relaunch-todo.md)** (decisions · operator · agent · soft polish · order). Summary:

1. Operator: Base Sepolia preview factories first; Base+Eth prod when ready; media/Postgres/indexer/clean-room.
2. Social: web signer Phase A when submit URL + app FID land ([signer plan](./2026-11-13-hypersnap-signer-and-clients.md)).
3. Soft parallel: Studio management polish, Studio↔Social links, feed ranking freeze/pass.
4. Tip green → single cutover to `main` / production.

See [Cutover and Durability Plan](../CUTOVER_AND_DURABILITY_PLAN.md) and [branch catch-up](./2026-11-12-branch-catchup-and-factory-status.md).

---

## Key paths

```
apps/studio/                 UI (port 3001)
apps/studio/src/app/api/     Collections + drafts + media + factories
packages/collection-contracts/
packages/collection-contracts/deployments/manifest.json
packages/collection-indexer/
packages/media/
archive/studio-app-archived/   Arweave UX reference only
```

---

## Paste for new chat

> Catch-up: tip `cursor/cloud-agent-1793668111647-jftwu` stacks Social + Studio + factory launch. **No incremental `main` merges** — all-at-once relaunch when minting + Social work on branch. PR #198 tracks tip (conflicts expected). **No Base/Eth factories deployed.** Read `docs/plans/2026-11-12-branch-catchup-and-factory-status.md` + `cryptoart-studio-status.md`.
