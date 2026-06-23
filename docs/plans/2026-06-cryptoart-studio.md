# cryptoart.studio — Product & Implementation Plan

**Status:** Approved direction, not yet in development  
**App:** `apps/studio` (new)  
**Domain:** cryptoart.studio  
**Date:** 2026-06-23  
**Supersedes:** Defer-separate-app decision in [app-evolution-roadmap.md](../app-evolution-roadmap.md) for minting/collection tooling

---

## Summary

**cryptoart.studio** is the on-chain artist dashboard — our equivalent of [studio.manifold.xyz](https://studio.manifold.xyz). Artists deploy collections, mint work, and manage contracts here. **cryptoart.social** remains the art-centric social client and marketplace surface; listing pages will eventually exist on both domains with shared data.

This plan covers **Stage A** (minting + management). Listing UI, profile listing URLs, and cross-domain share links are **Stage B**.

Backend for collection deployment is largely complete (Phases 1–5 of [collection deployment tracking](./2025-05-19-collection-deployment-tracking.md)): contracts, DB, indexer, REST API. Stage A is primarily **frontend + media pipeline + drafts + app scaffold**.

---

## Product Vision

| Property | cryptoart.studio | cryptoart.social |
|----------|------------------|------------------|
| Role | Creator control plane | Art-centric social + marketplace |
| Primary user | Artist deploying/minting | Collector + artist social presence |
| Auth | Wallet + Farcaster; explicit active wallet | Wallet + Farcaster |
| Stage A | Deploy, mint, manage, public preview | Unchanged (no minting UI here) |
| Stage B | In-app listing + sharable listing URLs | Feed, comments on listings, art events |

**Design direction (prototype):** Minimal black/white, bold type, rounded borders, flat. Full brand system revisited later. i18n structure acceptable in Stage A; English-only copy is fine.

**Not in scope:** ERC-6551 / Such Gallery vaults, subscriber tools, lazy mint (Stage B+), BYO IPFS pin (Stage C), tag taxonomy.

---

## Stage Roadmap

| Stage | Scope |
|-------|-------|
| **A** (this plan) | `apps/studio`, deploy wizard, drafts, Arweave upload, single mint, series zip mint, collection/token management, public pages |
| **B** | Listing UI/UX, dashboard listings section, sharable URLs (`/@user/listings/1`) on Studio + Social |
| **B1** | Airdrop + transfer tools |
| **C** | Artist self-pins IPFS and supplies URI |
| **Future** | ERC721A or lazy-mint extensions for 10k+ collections; LSSVM pools; additional edition types in deploy wizard |

---

## Locked Product Decisions

| Topic | Decision |
|-------|----------|
| Storage | Arweave; artist pays pinning fees at upload |
| Draft resume | Server-side drafts; pinned Arweave URIs stored in payload (no double-pay on resume) |
| Series batch size | No hard cap; soft UI guidance only (gas warnings, suggested batch sizes) |
| Volume stat | Show `—` on collection table until Stage B listings |
| Public pages | Yes — collection + token preview without wallet |
| Listings on dashboard | Omit until Stage B |
| Royalties | 10% default (1000 BPS); opt-out to 0%; no custom % UI |
| Collection branding | Optional at deploy; editable later via PATCH + manage flow |
| Metadata | OpenSea metadata standard; required before mint (no pending-metadata UX) |
| Chains | Base + Ethereum mainnet at launch |
| Lazy mint | Out of scope for Stage A |
| API location | `/api/collections/*` and new routes live in `apps/studio` |

---

## Information Architecture

### Routes (Stage A)

```
/                                      Landing + hero (unauthenticated)
/dashboard                             Artist home (authenticated)

/collections/new                       Collection deploy wizard (multi-step, draft-backed)
/collections/[id]                      Collection dashboard (owner)
/collections/[id]/mint                 Single-piece mint wizard
/collections/[id]/series               Series upload wizard (2 pages)

/c/[chainId]/[address]                 Public collection page
/c/[chainId]/[address]/[tokenId]       Public token page ("View")
```

Stage B adds listing routes and profile-scoped URLs (`/@username/listings/[id]`).

### Dashboard (authenticated)

**Sections:**

1. **Hero / value prop** — tools on offer; connect wallet CTA when logged out
2. **Create new collection** — primary CTA → `/collections/new`
3. **Drafts** — resume or delete (delete requires confirm outside wizard)
4. **Your collections** — table: name, chain, item count, volume (`—`)

**Not shown until Stage B:** listings, pools.

**Persistent wallet bar:** connected address, chain, copy such as “This wallet will sign transactions.” Warn when connected wallet ≠ on-chain collection owner for manage/mint actions.

### Collection deploy wizard

Paged walkthrough with back navigation; auto-save draft on step advance.

| Step | Content |
|------|---------|
| 1 | **Chain** — Base or Ethereum |
| 2 | **Edition type** — One vs Multiple (informational; does not branch into series upload) |
| 3 | **Name + symbol** |
| 4 | **Royalties** — 10% default; toggle to opt out |
| 5 | **Branding** — optional description, image, banner |
| 6 | **Metadata / best practices** — OpenSea schema context; thumb guidance (sizes, GIF/still for animation, ≤5MB thumbs for large files) |
| 7 | **Review + deploy** — API prepares tx → wallet signs → poll deployment status |

Deploy creates the contract only; minting is a separate flow afterward.

### Single mint (`/collections/[id]/mint`)

| Step | Content |
|------|---------|
| 1 | Media upload → Arweave quote → artist pays → pin |
| 2 | Metadata form (OpenSea: name, description, image, animation_url, attributes) |
| 3 | Review — metadata JSON pinned before mint enabled |
| 4 | On-chain `SuchCollection.mint(to, uri)` |

### Series mint (`/collections/[id]/series`)

Two-page wizard; strict zip structure validation against downloadable example.

**Page 1 — Instructions**

- Step-by-step explanation
- Download example zip (`/downloads/series-example.zip`)
- Soft guidance: suggested batch sizes for gas; Base vs Ethereum; multi-session for very large sets

**Page 2 — Upload**

- Zip upload; validate folder structure and per-token metadata
- On pass: pin assets to Arweave → build URIs → `mintBatch(to, uris[])`
- Progress UI: validate → pin → mint
- Estimated gas warning before tx (non-blocking)

**Example zip structure:**

```
series-example/
├── README.txt
├── 1/
│   ├── image.png              # or animation.mp4 + thumbnail.gif
│   └── metadata.json
├── 2/
│   ├── image.png
│   └── metadata.json
└── ...
```

Each `metadata.json` follows OpenSea schema; `image` must reference a file in the same folder.

### Collection dashboard (owner)

- Header: name, chain, contract address, optional branding, stats (# items, volume `—`)
- Token table: token id, name, thumb → **Manage** | **View**
- **Manage:** edit metadata, re-upload to Arweave, `setTokenURI`; reserve UI slot for Stage B “Create listing”
- **View:** public token page

---

## Technical Architecture

### Existing (reuse)

| Component | Location | Notes |
|-----------|----------|-------|
| Contracts | `packages/collection-contracts/` | `createCollection`, `mint`, `mintBatch`, `setTokenURI` |
| Indexer | `packages/collection-indexer/` | Long-running process; not serverless |
| DB | `packages/db/` | 7 collection tables (migration `0023`) |
| Collections API | `apps/mvp/src/app/api/collections/` | Move to Studio; deps are `@cryptoart/db` + `viem` only |

Sepolia factory verified in [session notes](../../.opencode/session-cryptoart-studio.md). Base + Ethereum mainnet factory deploy + indexer config required before production launch.

### New in Stage A

| Work | Detail |
|------|--------|
| `apps/studio` | Next.js app, wagmi + RainbowKit + Farcaster auth (align with social) |
| Move API | Relocate collections routes; add Studio-specific routes |
| `collection_drafts` table | Server-side wizard state + Arweave URI persistence |
| Arweave pipeline | Quote + upload (port patterns from `archive/studio-app-archived`) |
| Series endpoints | Zip validate + batch process |
| Example zip | Static asset + README |
| Public pages | Read-only collection/token views from indexer-backed API |

### Draft payload shape

```ts
{
  step: number,
  chainId: number,
  editionType: 'one' | 'multiple',
  name: string,
  symbol: string,
  royaltiesOptOut: boolean,
  branding?: {
    description?: string,
    imageUrl?: string,
    bannerUrl?: string,
  },
  metadata?: Record<string, unknown>,
  arweave?: {
    assets: Array<{
      localId: string,
      arweaveUrl: string,
      mimeType: string,
      role: 'image' | 'animation' | 'thumb',
    }>,
    metadataJsonUri?: string,
  },
}
```

### API surface (Stage A)

**Existing (move from mvp):**

| Method | Path |
|--------|------|
| POST | `/api/collections/deploy` |
| POST | `/api/collections/deploy/[deploymentId]/submit` |
| GET | `/api/collections/deploy/[deploymentId]/status` |
| GET | `/api/collections` |
| GET/PATCH | `/api/collections/[collectionId]` |
| GET | `/api/collections/[collectionId]/tokens` |
| GET | `/api/collections/[collectionId]/tokens/[tokenId]` |
| GET | `/api/collections/[collectionId]/transfers` |

**New:**

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/drafts` | List / create draft |
| GET/PATCH/DELETE | `/api/drafts/[draftId]` | Read / update / delete |
| POST | `/api/upload/quote` | Arweave cost estimate |
| POST | `/api/upload` | Pin after payment |
| POST | `/api/series/validate` | Zip structure validation |
| POST | `/api/series/process` | Batch pin + manifest for `mintBatch` |

Auth: replace bare `ownerAddress` body checks with session tied to connected wallet (and optionally FID).

### Auth model

- Wallet connect via RainbowKit (Base + mainnet)
- Farcaster identity for display (same stack as `apps/mvp`)
- Studio must be **more explicit** than social about which wallet is active and will sign
- Manage/mint requires connected wallet === `collections.ownerAddress`

### Large collections (future — not Stage A)

Current `SuchCollection` uses standard ERC721 with per-token URI storage. `mintBatch` loops linearly — fine for Stage A, not for 10k mints.

Future options (revisit when needed):

- **ERC721A** in a new collection implementation
- **Lazy mint extension** via existing `registerExtension` machinery
- **Base URI + sequential IDs** for homogeneous metadata

Likely a second factory version or edition-type branch at deploy (“standard” vs “bulk”). Wizard step 2 (edition type) is the future hook.

---

## Implementation Phases

Work is ordered for incremental delivery. GitHub Issues (see [Execution tracking](#execution-tracking)) map to these phases.

### Phase 0 — Scaffold & docs

- [ ] Create `apps/studio` Next.js app in monorepo
- [ ] Minimal design tokens (B/W, rounded, flat)
- [ ] Wallet + Farcaster auth shell with explicit active-wallet UI
- [ ] Landing page + empty dashboard
- [ ] Turborepo / Vercel project config for cryptoart.studio

### Phase 1 — API migration

- [ ] Move `/api/collections/*` from `apps/mvp` to `apps/studio`
- [ ] Shared env: `STORAGE_POSTGRES_URL`, `CHAIN_{id}_FACTORY_ADDRESS`
- [ ] Smoke test against existing Sepolia data

### Phase 2 — Drafts

- [ ] DB migration: `collection_drafts`
- [ ] Draft CRUD API
- [ ] Dashboard drafts table (resume, delete with confirm)

### Phase 3 — Arweave upload

- [ ] Port quote + upload flow from archived studio
- [ ] Single-file upload component
- [ ] URI persistence in draft payload

### Phase 4 — Deploy wizard

- [ ] Multi-step wizard with back nav + auto-save
- [ ] Deploy tx + status polling
- [ ] Post-deploy redirect to collection dashboard

### Phase 5 — Collection dashboard + public pages

- [ ] Owner collection dashboard + token table
- [ ] Public collection + token pages
- [ ] Manage flow: metadata edit + `setTokenURI`

### Phase 6 — Single mint

- [ ] Mint wizard (upload → metadata → review → tx)

### Phase 7 — Series mint

- [ ] Example zip asset + README
- [ ] Page 1 instructions + download
- [ ] Page 2 validate + batch pin + `mintBatch`
- [ ] Gas estimate warning (non-blocking)

### Phase 8 — Production infra

- [ ] Deploy factory to Base + Ethereum mainnet
- [ ] Indexer config for both chains
- [ ] Hosted indexer process (PM2/systemd/Railway — TBD)
- [ ] cryptoart.studio DNS + Vercel deploy

---

## Dependencies & References

| Doc / artifact | Relevance |
|----------------|-----------|
| [2025-05-19-collection-deployment-tracking.md](./2025-05-19-collection-deployment-tracking.md) | Backend phases 1–5 (complete) |
| [minting-spec.md](../minting-spec.md) | Lazy mint + post-mint marketplace (Stage B+) |
| [app-evolution-roadmap.md](../app-evolution-roadmap.md) | Prior “stay in mvp” decision — superseded for minting by this plan |
| `archive/studio-app-archived/` | UX reference; Arweave upload patterns; **not** API-compatible |
| `.opencode/session-cryptoart-studio.md` | Sepolia E2E verification log |

---

## Execution Tracking

### Recommended: repo spec + GitHub Project

Use **both** layers:

| Layer | Purpose | Location |
|-------|---------|----------|
| **Spec (source of truth)** | Decisions, architecture, routes, data models | This file — reviewed via PR |
| **GitHub Project** | Kanban, milestones, assignees, sprint view | GitHub → Projects → “cryptoart.studio” |
| **GitHub Issues** | One issue per phase task or vertical slice | Linked to Project + milestone |

**Why not PR-only:** Stage A spans a new app, DB migration, API move, media pipeline, and ~15 screens. A single PR cannot track progress or parallel work. The markdown spec stays stable; Issues track execution.

**Suggested Project columns:** Backlog → Ready → In Progress → Review → Done

**Suggested milestones:**

1. Scaffold + API migration
2. Drafts + Arweave
3. Deploy wizard
4. Mint flows (single + series)
5. Public pages + manage
6. Mainnet launch

### Creating the GitHub Project

```bash
# Requires gh auth with project scope:
gh auth refresh -s project

# Create project (user or org):
gh project create --owner mxjxn --title "cryptoart.studio" --format json

# Create milestone + issues from phases above, then:
gh project item-add <project-number> --owner mxjxn --url <issue-url>
```

Issue labels to add: `studio`, `stage-a`, `stage-b`, `backend`, `frontend`, `infra`.

---

## Open Items (resolve during build)

- [ ] Arweave bundler / payment flow details (client vs server relay)
- [ ] Exact Farcaster auth package alignment with latest `apps/mvp` patterns
- [ ] Indexer hosting target for production
- [ ] Whether `apps/mvp` collections API stays as proxy during transition or is removed immediately after Studio ships
- [ ] i18n library choice (`next-intl` vs other)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-23 | Initial plan from product discovery session |
