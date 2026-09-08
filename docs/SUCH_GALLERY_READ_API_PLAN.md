# such.gallery Read API Plan

**Status:** Proposed integration plan  
**Updated:** 2026-09-08

## Current state

`such-gallery-elixir` already provides the right authoring system for the first
integration:

- PostgreSQL records for galleries, templates, artwork placements, and artworks.
- Owner-only SIWE curation at `/galleries/:slug/curate`.
- A public 2D magazine route at `/gallery/:slug` and a 3D walk at
  `/gallery/:slug/walk`.
- Artwork lookup for Cryptoart listing URLs, NFT references, wallet inventory, and
  direct contract/token lookup.
- Phoenix Channels, Presence, and chat for the live gallery experience.

The Social integration should not consume Phoenix HTML or channel state. It needs
a small public, versioned exhibition read API.

## First API contract

Add these public endpoints to `such-gallery-elixir`:

```text
GET /api/v1/exhibitions/:slug
GET /api/v1/exhibitions/:slug/manifest/:revision
```

The first endpoint returns the currently published revision and cache metadata.
The second returns an immutable publication snapshot. A draft or unpublished
gallery must return no public exhibition record.

The publication snapshot contains only information Social can safely display:

```json
{
  "schemaVersion": 1,
  "revision": 4,
  "publishedAt": "2026-09-08T12:00:00Z",
  "gallery": {
    "slug": "works-in-public",
    "title": "Works in Public",
    "description": "…",
    "curator": { "wallet": "0x…", "displayName": "@mxjxn" }
  },
  "placements": [
    {
      "position": 1,
      "artwork": {
        "chainId": 1,
        "contractAddress": "0x…",
        "tokenId": "42",
        "title": "…",
        "artist": "…",
        "canonicalMediaUri": "ar://…",
        "previewUrl": "https://…"
      },
      "caption": "…"
    }
  ]
}
```

`canonicalMediaUri` is required when known. `previewUrl` is an expendable,
cacheable display convenience. The source record must preserve the EVM artwork
identity where one exists; an unstructured `external_id` alone is not sufficient
for Social artwork pages, market gestures, or reconstruction.

## Publication model

Add publication state separately from live gallery editing:

- `draft` — visible only to the owner and authorized editors.
- `published` — points to one immutable revision.
- `unpublished` — removes the current public entry without deleting history.

Publishing creates a snapshot of gallery metadata, placement order, curator
identity, captions, and artwork identities. Editing a live gallery creates a new
draft; it never mutates a revision already consumed by Social. Every publication,
unpublication, and editorial override enters an audit record.

The snapshot is the eventual object exported to the public reconstruction set and
anchored to Arweave. The database remains the fast authoring and query layer.

## Authorization boundary

For the first release, gallery editing stays in `such-gallery-elixir` under its
existing SIWE session and owner checks. Social reads published exhibitions without
authentication. Cross-domain single sign-on is deferred.

Before shared editorial controls ship, the gallery app needs scoped roles that
align with the platform model:

- gallery owner: edits their gallery;
- curator: submits or edits within a gallery scope;
- editor: publishes approved revisions to Social slots;
- admin: manages scopes and operational exceptions.

Wallet authority must remain the source of truth. Farcaster identity is attached
for display and discovery, not used to authorize gallery changes.

## Social adapter

Social adds a server-side `such.gallery` client that:

1. Fetches the current publication by slug.
2. Validates `schemaVersion` and required artwork identities.
3. Stores the last known-good manifest and ETag/revision.
4. Serves stale published content during a temporary gallery outage.
5. Maps each placement to Cryptoart’s normalized `Exhibition` and `Artwork`
   contracts.
6. Resolves active market gestures separately through the auctionhouse and future
   such.market read models.

The native Social exhibition is a fast 2D presentation. The 3D walk is linked as
an optional deep experience; Phoenix presence and chat stay on such.gallery until
there is a specific reason to merge them.

## Delivery sequence

1. Add structured EVM artwork identity and curatorial copy to gallery placements.
2. Add draft/published/unpublished state and immutable revision snapshots.
3. Add the two public read endpoints and contract tests.
4. Add an editorial publication audit trail and scoped roles.
5. Build the Social server adapter and replace the current exhibition fixture.
6. Cache publication snapshots and export them to the reconstruction set.
7. Attach active market gestures to placement artwork identities in Social.

## Explicit non-goals

- Do not move the 3D walk, Presence, or chat into Social.
- Do not let Social directly write the gallery database.
- Do not make a live gallery edit silently change a published Social exhibition.
- Do not couple publication availability to an Alchemy response or a single media
  gateway.
