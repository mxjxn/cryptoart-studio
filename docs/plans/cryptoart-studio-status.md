# cryptoart.studio — compact status

**Updated:** 2026-06-23  
**Full spec:** [2026-06-cryptoart-studio.md](./2026-06-cryptoart-studio.md)  
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
- **Chains:** Base + Ethereum.
- **API home:** `apps/studio` (move from mvp).

---

## Done

| Layer | Status |
|-------|--------|
| Spec + issues + project | ✅ |
| `packages/collection-contracts` | ✅ Sepolia factory |
| `packages/collection-indexer` + DB `0023` | ✅ |
| `/api/collections/*` in **apps/studio** | ✅ (moved from mvp) |
| `apps/studio` scaffold (#159) | ✅ main |
| Dev ASCII banner (#171) | ✅ main |
| Auth (#160) | ✅ main |

---

## Next (in order)

1. ~~Merge **#170** (auth)~~ ✅
2. **#161** — move collections API → studio (branch `feat/studio-api-move`, PR pending)
3. **#162** — `collection_drafts` + API
4. **#163** — Arweave quote/upload
5. **#165** — deploy wizard
6. **#164** — collection dashboard + public pages
7. **#166** / **#167** — single + series mint
8. **#168** — mainnet factories + indexer ops

---

## Key paths

```
apps/studio/          UI (port 3001, pnpm dev:studio)
apps/studio/src/app/api/collections/   Collections API
packages/collection-contracts/
packages/collection-indexer/
archive/studio-app-archived/    Arweave UX reference only
```

---

## Paste for new chat

> Building **cryptoart.studio** (`apps/studio`). Stage A = mint/manage only. Backend done (contracts, indexer). Main has scaffold, auth, dev banner; collections API in studio. **Next: #162 (drafts).** Read `docs/plans/cryptoart-studio-status.md` + `2026-06-cryptoart-studio.md`.
