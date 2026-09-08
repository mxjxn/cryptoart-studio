# Cryptoart Asset Discovery

**Status:** Initial implementation  
**Updated:** 2026-09-07

Cryptoart maintains a confidence-based asset registry. It does not promise a
complete global NFT index. The registry becomes more useful as artists and
collectors mint, list, curate, cast, pool, and import work through the platform.

## Identity and evidence

The canonical EVM asset identity is `(chainId, contractAddress, tokenId)`. The
registry keeps observations separately from identity so stale provider data does
not become permanent truth.

- **Authoritative Cryptoart observations:** Studio mints, auctionhouse events,
  such.gallery placements, LSSVM pool events, and structured cast attachments.
- **Discovery observations:** wallet snapshots from an NFT API provider.
- **Verified observations:** direct `ownerOf` or `balanceOf` contract reads made
  before an ownership-dependent action.
- **Manual observations:** user-submitted contract and token IDs. These are
  admitted only after current ownership is verified onchain.

Ownership and creation are separate relationships. “Created by you” will use
Studio records, known creator contracts, mint provenance, and explicit claims;
current wallet ownership alone does not establish authorship.

## Read path

1. Render cached known-good items immediately.
2. Discover token candidates on Ethereum and Base through the server-side
   provider adapter.
3. Resolve metadata and media progressively and retain unresolved valid tokens.
4. Verify ownership directly before listing, auction creation, gallery placement,
   or a manual import is accepted.
5. Let the user submit a missing `(chain, contract, tokenId)`.

The personal collection opens on Ethereum. Base inventory is available through
an explicit toggle because unsolicited airdrops are substantially noisier there
for the initial collector set. As Cryptoart observes trusted Studio, marketplace,
gallery, and pool contracts, a collection library will rank those known sources
ahead of unclassified provider results on either chain.

Provider spam labels are ranking and presentation evidence, not grounds for
permanent deletion. Missing metadata remains visible in a “Needs attention”
state with refresh and direct URI recovery added in a later iteration.

## Targeted indexing

Contract history is backfilled only when a contract enters Cryptoart through a
Studio deployment, artist submission, curator approval, gallery placement,
listing, auction, or pool. A backfill starts from a known deployment block or
contract event range. Cryptoart does not crawl every NFT contract on every chain.

## Current implementation

`apps/social/web/src/cryptoart/assetDiscovery.ts` provides the server-side Alchemy
adapter and onchain verification boundary. `/api/cryptoart/assets/owned` discovers
wallet items and `/api/cryptoart/assets/import` resolves and verifies a submitted
token. The market UI stores up to 300 compact asset records per wallet in local
storage and loads additional inventory through provider cursors. It caches token
identities and media URLs, not image bytes. Ethereum is queried by default; Base
is queried only after the user enables it. Metadata-missing tokens remain visible,
and each work offers import plus Cast, Discuss, List, and Studio paths.

Alchemy authentication uses the current server-side `Authorization: Bearer`
header form so credentials do not enter request URLs or browser code.

This browser cache is an interim read-through registry. A persistent platform
read model will later store asset identities, observations, metadata snapshots,
claims, verification timestamps, and visibility state.
