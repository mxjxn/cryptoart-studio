# Gallery Curation API Spec

## Overview

The off-chain curation layer powers SuchGallery's mutable exhibition surface. Every gallery NFT has a static IPFS base (image, 3D model, frame positions) set at mint, plus a mutable exhibition managed through this API.

The API serves two purposes:
1. **Enriched metadata** for `tokenURI` — overlays dynamic data on the static IPFS base
2. **Curator interface** — gallery owners edit exhibitions through a web UI backed by this API

## Architecture

```
Blender (pre-mint)          IPFS (immutable)           API (mutable)
┌──────────────┐           ┌──────────────┐          ┌──────────────────┐
│ 30 galleries │──render──▶│ image        │          │ exhibition data   │
│ geometry     │──export──▶│ glTF model   │          │ frame assignments │
│ nodes → seed │──bake────▶│ frame data   │◀─merge──▶│ external content  │
│ per tokenId  │           │ metadata.json│          │ captions, links   │
└──────────────┘           └──────────────┘          └──────────────────┘
                                  │                          │
                                  │    ┌──────────────┐      │
                                  └───▶│ tokenURI     │◀─────┘
                                       │ response     │
                                       └──────────────┘
```

## Base Metadata (IPFS, static)

Generated during Blender render, pinned before deploy.

```json
{
  "name": "SuchGallery #7",
  "description": "A curated on-chain gallery. wow.",
  "image": "ipfs://Qm...gallery7-render.png",
  "model_url": "ipfs://Qm...gallery7.glb",
  "external_url": "https://such.gallery/7",
  "properties": {
    "season": 1,
    "max_frames": 12,
    "collection_size": 30,
    "gallery_seed": 7
  },
  "frames": [
    {
      "id": 0,
      "position": [1.2, 1.5, -3.9],
      "rotation": [0, 0, 0],
      "dimensions": [1.0, 1.0],
      "wall": "north"
    },
    {
      "id": 1,
      "position": [-2.1, 1.8, -3.9],
      "rotation": [0, 0.15, 0],
      "dimensions": [0.8, 1.2],
      "wall": "north"
    }
  ]
}
```

## Exhibition Data (API, mutable)

Managed by the gallery owner through the curator interface.

```json
{
  "galleryId": 7,
  "version": 14,
  "updatedAt": "2026-05-18T19:30:00Z",
  "updatedBy": "0xabc...123",
  "exhibition": {
    "title": "Light Studies",
    "curator_note": "Exploring luminance across generative and traditional media.",
    "started_at": "2026-05-10T00:00:00Z",
    "frames": [
      {
        "frame_id": 0,
        "content": {
          "type": "deposited",
          "collection": "0x3EEb2E4A47E6E1B1eB7D7AeE44e0E3C9eE5a8b2e",
          "tokenId": 42,
          "chain": "base",
          "caption": "Chromalattice #42"
        }
      },
      {
        "frame_id": 1,
        "content": {
          "type": "external_listing",
          "url": "https://foundation.app/@zancan/...",
          "artist": "zancan",
          "title": "Autumn Peonies",
          "price": "0.5 ETH",
          "caption": "Currently listed — proceeds to artist"
        }
      },
      {
        "frame_id": 2,
        "content": {
          "type": "image",
          "url": "ipfs://Qm...unsigned-work.png",
          "artist": "friend from the residency",
          "title": "untitled sketch",
          "caption": "Not minted — shared with permission"
        }
      },
      {
        "frame_id": 3,
        "content": {
          "type": "text",
          "content": "What is light without shadow?",
          "style": "quote"
        }
      },
      {
        "frame_id": 4,
        "content": {
          "type": "empty",
          "note": null
        }
      }
    ]
  },
  "vault": {
    "tba_address": "0x123...abc",
    "items_count": 3,
    "last_deposit_at": "2026-05-15T12:00:00Z"
  }
}
```

### Content Types

| Type | Description | Required Fields |
|------|-------------|----------------|
| `deposited` | Art in gallery's TBA (on-chain) | `collection`, `tokenId`, `chain` |
| `external_listing` | Art for sale elsewhere | `url`, `artist`, `title` |
| `image` | Any image (minted or not) | `url` |
| `text` | Plain text panel | `content` |
| `empty` | Unassigned frame | — |

## API Endpoints

### Read

```
GET /api/gallery/:tokenId/metadata
```
Merged view — IPFS base + current exhibition overlay. This is what `tokenURI` could point to, or what the viewer fetches.

```
GET /api/gallery/:tokenId/exhibition
```
Current exhibition data only. Used by the viewer to render the gallery.

```
GET /api/gallery/:tokenId/vault
```
On-chain vault state — reads from the TBA's ERC-721/ERC-1155 balances. Cross-references with `registerDeposit` events.

### Write (curator only)

```
PUT /api/gallery/:tokenId/exhibition
Body: full exhibition JSON
Auth: signed message from gallery owner or DAO curator
```

```
PATCH /api/gallery/:tokenId/frames/:frameId
Body: { "content": { ... } }
Auth: signed message from gallery owner or DAO curator
```

```
DELETE /api/gallery/:tokenId/exhibition
Auth: signed message from gallery owner (clears all frames to empty)
```

### Authentication

All write endpoints require a signed EIP-712 message:

```typescript
const domain = {
  name: "SuchGallery",
  version: "1",
  chainId: 8453, // Base
};

const types = {
  CuratorAction: [
    { name: "galleryId", type: "uint256" },
    { name: "action", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};
```

The API verifies:
1. Signature recovers to the gallery NFT owner (for solo) or the designated curator (for collective)
2. Nonce hasn't been used (replay protection)
3. Deadline hasn't expired

### Versioning

Every exhibition update increments a `version` counter. The API stores version history:

```
GET /api/gallery/:tokenId/exhibition/history?page=1&per_page=10
```

Returns past exhibitions with timestamps — an archive of every show the gallery has presented.

## Indexer / Vault Sync

A lightweight indexer watches `registerDeposit` events and TBA balance changes:

```
// On registerDeposit(tokenId, collection, tokenId)
1. Record deposit in DB
2. Notify API to update vault state
3. If auto-assign enabled, find next empty frame and populate with deposited item

// On TBA ERC-721/ERC-1155 transfer out
1. Record withdrawal
2. Update vault state
3. Remove from any frame that references the withdrawn item
```

## Rendering Pipeline

When a visitor opens `such.gallery/:tokenId`:

1. Fetch base metadata from IPFS (gallery geometry, frame positions)
2. Fetch exhibition data from API (frame assignments, content)
3. For `deposited` frames, fetch the artwork's metadata (image from its own `tokenURI`)
4. For `external_listing` frames, fetch OG image from the URL
5. For `image` frames, load directly
6. Render 3D scene with artwork textures applied to frame meshes

## Data Storage

- **IPFS** — immutable base assets (image, model, frame geometry)
- **PostgreSQL** — exhibition data, version history, vault index
- **Redis** — cached merged metadata responses
- **On-chain** — ownership, deposits, TBA (source of truth for vault contents)

## Future Extensions (out of scope for v1)

- **Scheduled exhibitions** — set up a show that auto-activates at a specific time
- **Collaborative curation** — allow multiple addresses to submit frame suggestions, owner approves
- **Exhibition templates** — pre-built layouts for common exhibition patterns
- **RSS/social feed** — "new exhibition at SuchGallery #7" notifications
- **Cross-gallery exhibitions** — loan artwork between galleries for a themed show
