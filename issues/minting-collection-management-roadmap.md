# Minting + Collection Management: Implementation Roadmap (Mainnet & Base)

## Summary

Add native minting to cryptoart.social so artists can create collections, mint tokens (ERC-721 and ERC-1155), and list them on the marketplace — all from within the app. Both Base and Ethereum mainnet. This covers collection management, the minting transaction flow, metadata/IPFS handling, and the post-mint listing pipeline.

This maps to **Milestone 1 + 2** of the [app evolution roadmap](../docs/app-evolution-roadmap.md) and implements the [minting spec](../docs/minting-spec.md).

---

## What Already Exists

### Contracts
- **Auctionhouse Marketplace** deployed on Base (`0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9`) and mainnet (`0x3CEE515879FFe4620a1F8aC9bf09B97e858815Ef`)
- **Marketplace ABI** in `apps/mvp/src/lib/contracts/marketplace.ts` — includes `createListing` with `lazy: bool` on `TokenDetails`
- **Manifold Creator Core** extensions on mainnet (ERC721 Edition, Lazy Claim ERC721/ERC1155, Burn Redeem) — see `docs/CONTRACT_ADDRESSES.md`
- **Creator Core on Base Sepolia** (testnet only: `0x6302C5F1F2E3d0e4D5ae5aeB88bd8044c88Eef9A`)
- No Creator Core deployment on **Base mainnet** yet

### App
- **Create listing flow** at `/create` (`CreateAuctionClient.tsx`) — selects existing NFT, creates marketplace listing. Uses wagmi `useWriteContract`, supports Base + mainnet chain switching
- **IPFS gateway rewriting** — `rewritePublicIpfsUrlForClient()` with Pinata gateway support
- **NFT metadata fetching** — `fetchNFTMetadata()` reads `tokenURI`/`uri` from on-chain, parses JSON, handles animation URLs
- **Thumbnail generation** — server-side thumbnail pipeline (`listing-enrichment-capped.ts`)
- **Subgraph** — indexes listings, bids, purchases across both chains with `chainId`

### What Does NOT Exist
- No Creator Core contract deployment on Base mainnet
- No collection creation UI or transaction flow
- No mint transaction (no `mint()` call to Creator Core)
- No IPFS upload/pinning from the app
- No metadata builder/form (artist fills in name, description, tags, media)
- No collection management dashboard
- No lazy mint implementation

---

## Implementation Phases

### Phase 1: Collection Creation on Base Mainnet

**Goal:** Artist deploys a Manifold Creator Core collection contract on Base.

**Tasks:**
1. **Deploy Creator Core on Base mainnet**
   - Fork/deploy Manifold Creator Core (ERC721Creator + ERC1155Creator) on Base
   - Document addresses in `CONTRACT_ADDRESSES.md`
   - ABI in `apps/mvp/src/lib/contracts/creator-core.ts`

2. **Collection creation UI** (`/create/collection`)
   - Form: collection name, symbol, description, banner image, chain selector (Base/mainnet)
   - Wallet check: must be connected, correct chain
   - Transaction: deploy or register collection via factory pattern
   - On success: store collection record in database, redirect to collection page

3. **Collection data model**
   - `collections` table: `id`, `address`, `chain_id`, `owner_address`, `name`, `symbol`, `description`, `banner_image_url`, `token_spec` (ERC721/ERC1155), `created_at`
   - API: `GET /api/collections`, `GET /api/collections/[address]`, `GET /api/collections/owner/[address]`

4. **Collection page** (`/collection/[address]`)
   - Display collection info + all tokens in the collection
   - Grid of tokens with thumbnail, name, edition info
   - Owner info, links to marketplace listings for tokens in this collection

### Phase 2: Direct Mint (Mint Then List)

**Goal:** Artist mints an NFT into their collection, then lists it on the marketplace.

**Tasks:**
1. **IPFS upload pipeline**
   - Media upload endpoint: `POST /api/upload/media` — accepts image/video, pins to IPFS via Pinata, returns CID
   - Metadata upload endpoint: `POST /api/upload/metadata` — builds JSON per spec, pins to IPFS, returns CID
   - Size limits: images 50MB, video 500MB (configurable)
   - Store CID in database for persistence verification

2. **Mint transaction flow**
   - New page or modal: `/create/mint` or step within `/create`
   - Select collection (from artist's collections)
   - Upload media + fill metadata (name, description, tags, edition size)
   - Transaction: call `mint()` on Creator Core contract → token created in artist's wallet
   - On-chain: `tokenURI` set to `ipfs://<metadata-cid>`
   - On success: auto-redirect to listing creation with the newly minted token pre-filled

3. **Tag system foundation**
   - Curated root tags (~50): generative, photography, painting, 3D, abstract, glitch, etc.
   - Free-form artist subtags stored alongside
   - Tags stored in metadata JSON and in database for search indexing
   - Tag normalization (lowercase, trim, dedupe)

4. **Post-mint listing integration**
   - After mint, redirect to `/create` with `tokenAddress` and `tokenId` pre-filled
   - Existing `CreateAuctionClient` handles the rest (auction/fixed-price/offers)

### Phase 3: Collection Management Dashboard

**Goal:** Artists can manage their collections, view minted tokens, track sales.

**Tasks:**
1. **Dashboard page** (`/studio` or `/profile/collections`)
   - List of artist's collections with token counts, floor price, total volume
   - Per-collection view: all tokens, listed/unlisted status, mint dates
   - Quick actions: mint new token, list unlisted token, edit collection metadata

2. **Collection editing**
   - Update collection description, banner image
   - Manage royalty receivers and BPS (if Creator Core supports)
   - View transfer/mint history

3. **Analytics basics**
   - Token count, editions remaining (ERC-1155)
   - Sales count, total revenue
   - Current listings with bid/purchase status

### Phase 4: Mainnet Parity

**Goal:** Everything works identically on Ethereum mainnet.

**Tasks:**
1. **Deploy Creator Core on mainnet** (or use existing Manifold deployments if compatible)
2. **Chain-aware collection creation** — switch between Base and mainnet in the UI
3. **Mainnet gas considerations** — clearer gas estimates, confirmation UI adapted for higher costs
4. **Cross-chain collection view** — `/collection/[address]?chain=1` or `/collection/base/[address]` + `/collection/eth/[address]`
5. **Test the full mint → list → purchase flow on mainnet** with a test collection

### Phase 5: Lazy Mint (Future)

**Goal:** Gas-free listing creation. Token mints on purchase.

*This phase is documented in `docs/minting-spec.md` section 2. Not in scope for the initial minting rollout, but the data model and contract support (`lazy: true`) should be kept in mind during implementation.*

---

## Key Design Decisions Needed

1. **Creator Core deployment strategy** — Deploy our own Creator Core instances on Base mainnet, or integrate with existing Manifold factory? Our own gives full control but more maintenance.
2. **IPFS pinning provider** — Pinata (already configured for gateway)? Dedicated dedicated pinning? Self-hosted IPFS node? Media permanence is critical — broken IPFS = broken NFT.
3. **Collection factory vs individual deploys** — Factory pattern saves gas and enables discovery. Individual deploys are simpler but harder to enumerate.
4. **ERC-721 only at first, or ERC-1155 too?** — 721 is simpler (1/1s). 1155 adds editions but more complexity in mint flow and supply tracking.
5. **Upload before mint or atomic?** — Two-step (upload → mint) is simpler and lets artist preview. Atomic (upload + mint in one tx) is cleaner but harder to recover from failures.
6. **Collection ownership verification** — How do we verify the connected wallet owns/created the collection? On-chain owner check vs database record?

## Relevant Files

- `docs/minting-spec.md` — Full minting specification (direct + lazy)
- `docs/app-evolution-roadmap.md` — Milestone plan (M1 = core platform, M2 = minting expansion)
- `docs/CONTRACT_ADDRESSES.md` — All deployed contract addresses
- `apps/mvp/src/app/create/CreateAuctionClient.tsx` — Existing listing creation flow
- `apps/mvp/src/lib/contracts/marketplace.ts` — Marketplace ABI + addresses
- `apps/mvp/src/lib/nft-metadata.ts` — NFT metadata fetching
- `apps/mvp/src/lib/ipfs-gateway-public-url.ts` — IPFS URL rewriting for browser
- `apps/mvp/src/lib/server/listing-enrichment-capped.ts` — Thumbnail generation pipeline

## Dependencies

- Manifold Creator Core contracts (need deployment on Base mainnet)
- IPFS pinning service account (Pinata or equivalent)
- Database migration for `collections` table + `tags` table
- wagmi/viem for transaction handling (already in use)
