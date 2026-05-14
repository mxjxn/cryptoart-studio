# Minting Specification

**Status:** Draft
**Depends on:** Existing marketplace contracts (Base + mainnet), Manifold Creator Core
**Relates to:** [channel-feed-spec.md](./channel-feed-spec.md), [feed-curation-spec.md](./feed-curation-spec.md)

---

## Overview

Artists need two paths from finished work to listed artwork:

1. **Direct mint** — token exists on-chain immediately, held in artist's wallet. Standard ERC-721/ERC-1155 via Manifold Creator Core. Already functional.
2. **Lazy mint** — metadata is prepared and stored off-chain, token doesn't materialize until a collector claims it. Gas deferred to the point of sale.

Both paths must work on Base and Ethereum mainnet. The contracts already support lazy minting (`lazy: bool` on `TokenDetails` in `MarketplaceLib`). This spec covers the application-layer flow.

---

## 1. Direct Mint (Already Functional)

### Current State

Manifold Creator Core handles token creation. Artists mint through the Manifold UI or programmatically. Tokens land in their wallet, then they create a marketplace listing.

### What Exists

- Manifold Creator Core deployed on Base + mainnet
- Marketplace contracts with `lazy: false` listing support
- Subgraph indexing listings, bids, purchases with `chainId`
- `/api/favorites/listings` endpoint for viewing saved work
- `follows` table for artist-level following

### What Needs Building

Nothing for direct mint itself. The minting UX is Manifold's domain. Our concern is what happens after mint: listing, feed enrichment, and notification.

### Post-Mint Integration Points

After an artist mints and lists:

- **Feed enrichment:** Channel feed detects new listing from followed artist, surfaces with listing card ([channel-feed-spec.md](./channel-feed-spec.md))
- **Notifications:** Followers of the artist receive push notification for `LISTING_CREATED` event
- **Taste signal:** No taste signal from minting alone — signals come from collector behavior (favorites, purchases) as defined in [taste-signals-spec.md](./taste-signals-spec.md)

---

## 2. Lazy Mint

### Concept

Artist uploads artwork and metadata. Token does NOT exist on-chain yet. A marketplace listing is created referencing the unmined token. When a collector purchases, the token is minted directly to their wallet as part of the purchase transaction.

### Why Lazy Mint

- **No upfront gas for artist** — token only costs gas when someone buys it
- **Editions without commitment** — artist can prepare 100 editions, only minted as they sell
- **Lower barrier** — artist doesn't need ETH to create a listing, just to claim from purchases
- **On mainnet especially** — gas savings are meaningful; on Base it's less critical but the workflow is the same

### Contract Support

The marketplace contract already has `lazy: bool` on `TokenDetails`. When `lazy = true`:

- `token.address_` points to the Creator Core contract
- `token.id` is the token ID to be minted
- The marketplace handles minting on purchase via the Creator Core's `mint` function
- Metadata is expected to be available via the token's `tokenURI` after mint

### Flow

```
Artist                          Platform                           Collector
  │                                │                                  │
  │  1. Upload artwork + metadata  │                                  │
  │───────────────────────────────>│                                  │
  │                                │  2. Pin metadata to IPFS         │
  │                                │  3. Store listing record         │
  │                                │     (lazy=true, no token yet)    │
  │  4. Confirm listing created    │                                  │
  │<───────────────────────────────│                                  │
  │                                │                                  │
  │                                │  5. Listing appears in feed      │
  │                                │     (with "Lazy mint" badge)     │
  │                                │─────────────────────────────────>│
  │                                │                                  │
  │                                │                     6. Purchase  │
  │                                │<─────────────────────────────────│
  │                                │  7. Marketplace tx:              │
  │                                │     - Mint token to collector    │
  │                                │     - Transfer payment           │
  │                                │  8. Subgraph indexes sale        │
  │                                │  9. Notification to artist       │
  │  10. Sale notification          │  10. Notification to collector   │
  │<───────────────────────────────│                                  │
```

### Metadata Handling

Metadata must be **permanent and verifiable** before any token exists:

1. **Artist uploads:** image/video + metadata JSON (name, description, tags, edition info)
2. **Platform pins to IPFS:** both the media asset and the metadata JSON
3. **Metadata JSON structure:**
   ```json
   {
     "name": "Artwork Title",
     "description": "...",
     "image": "ipfs://Qm...",
     "animation_url": "ipfs://Qm...",
     "tags": ["generative", "dark", "abstract"],
     "edition": { "size": 100, "number": 1 },
     "external_url": "https://cryptoart.social/listing/{id}"
   }
   ```
4. **Hash stored:** the CID is stored in the database listing record for verification
5. **On mint:** the Creator Core contract stores the IPFS URI as the token's `tokenURI`. The metadata on-chain matches what was pinned pre-listing.

### Tag Vocabulary

Tags in metadata serve dual purpose:

- **Discovery:** tags are searchable, used in the feed's enrichment layer
- **Taste signal foundation:** when a collector favorites/purchases a lazy-minted work, its tags contribute to their taste vector ([taste-signals-spec.md](./taste-signals-spec.md))

Tag management approach: **hybrid**
- **Curated root tags:** platform-defined set of ~50 high-level descriptors (generative, photography, painting, sculpture, 3D, pixel, abstract, figurative, landscape, portrait, dark, vibrant, minimal, complex, organic, geometric, animated, static, audio, interactive, political, nature, urban, surreal, glitch, AI-assisted, hand-drawn, etc.)
- **Artist-added subtags:** free-form, stored alongside root tags. High-frequency subtags get promoted to curated set by admin.
- **No tag limit on creation:** let artists describe their work. Curation happens in the feed, not at upload.

### Lazy Mint Badge in Feed

Lazy-minted listings display a "Lazy mint" indicator in the feed and listing page. This signals to collectors:

- Token doesn't exist yet — you're the first owner
- Your purchase mints it directly to your wallet
- Gas for minting is included in the purchase price (or handled by the marketplace contract)

### Database Schema Addition

```
lazy_listings (extends existing listings flow)
├── id (serial, PK)
├── listing_id (text, FK to marketplace listing)
├── artist_address (text, not null)
├── metadata_cid (text, not null) — IPFS CID of metadata JSON
├── media_cid (text, not null) — IPFS CID of primary media
├── media_type (text) — image, video, audio, 3d
├── tags (text[]) — array of tag strings
├── chain_id (integer, not null) — 8453 (Base) or 1 (mainnet)
├── status (text, default 'pending') — pending, listed, sold, cancelled
├── total_supply (integer, default 1) — for editions (ERC-1155)
├── minted_count (integer, default 0) — how many have been claimed
├── mint_price (text) — price per token in ETH
├── created_at (timestamp)
└── updated_at (timestamp)
```

### API Endpoints

```
POST /api/lazy-mint/create
  Body: { artistAddress, metadata, mediaFile, chainId, mintPrice, totalSupply? }
  Auth: SIWE / Farcaster signature
  Response: { success: true, listingId, metadataCid, mediaCid }
  Flow: pin to IPFS → store in lazy_listings → create marketplace listing (lazy=true)

GET /api/lazy-mint/[listingId]
  Response: { listing data, metadata, status, mintedCount, remainingSupply }

GET /api/lazy-mint/artist/[address]
  Query: chainId?
  Response: { listings: [...] }

POST /api/lazy-mint/[listingId]/claim
  Body: { buyerAddress, quantity? }
  Auth: SIWE
  Flow: initiate marketplace purchase → contract mints token to buyer → update mintedCount
```

### Multi-Chain

Lazy minting works identically on both chains:

- **Base (chainId 8453):** low gas, fast finality. Default chain for new listings.
- **Mainnet (chainId 1):** higher gas, but collector demand and cultural signal. Artist chooses at creation.
- `getConfiguredSubgraphEndpoints()` already returns both chains — lazy mint listings are queryable across both.
- Each lazy listing record stores `chain_id` — feed enrichment and taste signals are chain-aware.

### Notification Events

Lazy minting adds new notification types to the existing `NotificationType` union:

```typescript
type NotificationType =
  | 'LISTING_CREATED'
  | 'NEW_BID'
  | 'BUY_NOW_SALE'
  | 'LAZY_MINT_CREATED'       // artist's lazy listing is live
  | 'LAZY_MINT_FIRST_CLAIM'   // first purchase of a lazy listing (artist only)
  | 'LAZY_MINT_SOLD_OUT'      // all editions claimed (artist only)
  // ... existing types
```

### Security Considerations

- **Metadata immutability:** IPFS CIDs are content-addressed. Once pinned, metadata can't be altered without changing the CID. Store the CID in the listing record — if it doesn't match at mint time, reject.
- **Artist verification:** only the artist (verified via SIWE/Farcaster) can create lazy listings. The contract enforces `token.address_` matches the artist's Creator Core contract.
- **Front-running protection:** lazy listings are created as on-chain marketplace entries. The listing exists on-chain before any claim can occur.
- **Media persistence:** IPFS pinning service (Pinata or similar) must have redundancy. Consider Pinata with backup pinning to a secondary service. Media must remain accessible indefinitely — if media goes offline, the token's `tokenURI` breaks.

---

## 3. Implementation Phases

### Phase 1: Direct Mint Integration (minimal)

- Wire existing mint flow to feed enrichment ([channel-feed-spec.md](./channel-feed-spec.md))
- Artist's new listings appear in channel feed with listing card
- `LISTING_CREATED` notification to followers
- Tags from metadata stored alongside listing for future taste signal use

### Phase 2: Lazy Mint MVP

- Upload flow: artwork + metadata → IPFS pin → database record
- Marketplace listing creation with `lazy=true`
- Lazy mint badge in feed and listing page
- Claim/purchase flow via existing marketplace contract
- Subgraph indexes lazy-minted sales (already supported via `lazy` field)
- Notifications: `LAZY_MINT_CREATED`, `LAZY_MINT_FIRST_CLAIM`

### Phase 3: Lazy Mint Full

- Edition tracking (ERC-1155): `totalSupply`, `mintedCount`, remaining
- Tag vocabulary with curated root tags + artist subtags
- Tag-based search and filtering in feed
- `LAZY_MINT_SOLD_OUT` notification
- Artist dashboard: lazy listing management, mint progress, claim history

---

## Open Questions

1. **IPFS pinning provider:** Pinata (paid, reliable) or self-hosted (cheaper, more ops)? Hybrid?
2. **Max media size:** what's the upload limit? Video files can be large. Separate limits per media type?
3. **Lazy mint for 1/1s vs editions:** should the UX differ? A 1/1 lazy mint is essentially "reserving the token for the first buyer." Editions are more complex (partial claims, supply tracking).
4. **Artist sets mint price or marketplace pricing?** Fixed price, auction, or both for lazy listings? Current marketplace supports both listing types.
5. **Cross-chain lazy listings:** can a lazy listing be created on Base and simultaneously on mainnet? Or always one chain per listing?
