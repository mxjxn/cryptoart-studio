# Cryptoart Cutover and Durability Plan

**Status:** Proposed execution plan  
**Updated:** 2026-09-08

## Objective

Replace the current `apps/mvp` deployment at `cryptoart.social` only after Social
can safely run the existing auctionhouse and its editorial surface. Complete
Studio as the artist-facing collection and minting application without making
Cryptoart pay ongoing media-storage costs.

The recovery target is stronger than “the app can be redeployed.” A capable
operator with this repository, public chain RPCs, the recorded deployment
manifest, and the public subgraph seed information must be able to reconstruct
the marketplace, collections, token metadata, and published exhibitions without
access to the original Cryptoart database or storage accounts.

## Workstreams and order

### 1. Shared identity and authorization

This precedes every privileged feature.

- Establish a server-verified wallet session using nonce-bound SIWE signatures.
- Join the wallet session to Farcaster identity without treating FID ownership as
  transaction authority.
- Use the connected wallet as the authority for seller and collection-owner
  operations.
- Define four application roles: `owner`, `admin`, `editor`, and `curator`.
- Store role grants with scope and expiry, and keep an append-only audit log.
- Bootstrap the owner role from a documented onchain address or multisig rather
  than an environment-only allowlist.

Curator grants should be scoped. A curator may receive feed weight, manage their
own galleries, or submit an exhibition without automatically receiving homepage
publication or marketplace administration rights. Editors can publish and order
approved material. Admins manage roles and operational exceptions. The owner can
recover administration on a fresh deployment.

### 2. Auction and listing parity in Social

- Port canonical Ethereum and Base listing routes, preserving existing URLs.
- Port bid, buy, cancel, settle, and edition purchase transactions.
- Add seller management views for scheduled, active, sold, ended, cancelled, and
  settlement-required listings.
- Show allowance, approval, chain-switch, pending, confirmation, replacement,
  failure, and recovery states explicitly.
- Reuse contract ABIs and transaction preparation in a shared package; do not
  duplicate transaction rules in Social and Studio.
- Preserve Open Graph routes, event-derived activity cards, cache invalidation,
  and explorer links.

### 3. Editorial administration

The first admin surface should be narrow and operational:

- Curator directory with wallet, FID, display identity, status, scopes, ranking
  weight, grant author, and expiry.
- Exhibition drafts, preview, publication slots, ordering, scheduling, and
  unpublishing.
- Marketplace selections and featured auction ordering.
- Feed policy controls for approved channels and curator weights.
- Complete audit history for grants and publication changes.

The existing MVP featured-section, homepage-layout, listing, user, and error tools
are migration sources. Each is either ported, replaced, or explicitly retired in
the route-parity inventory.

The joint gallery and market direction is specified in
[`MARKET_GESTURES_AND_GALLERY_MODEL.md`](./MARKET_GESTURES_AND_GALLERY_MODEL.md).

### 4. Artist-funded permanent media in Studio

Build and prove this vertical slice before finishing the mint wizards:

1. Client hashes every file and submits size, MIME type, and content hash.
2. Studio returns an expiring quote containing the exact file set, Arweave cost,
   service safety margin, accepted asset/network, recipient, and idempotency key.
3. The browser receives an x402 `402 Payment Required` response and signs the
   exact payment authorization.
4. The server verifies and settles the payment, then executes an idempotent upload
   job. Because Base settlement and Arweave inclusion cannot be atomic, every paid
   job must be resumable and must produce either confirmed uploads or a durable
   credit/refund obligation.
5. Upload media first and metadata JSON last. Metadata contains canonical
   `ar://` transaction IDs, content hashes, MIME types, dimensions, and animation
   or thumbnail relationships.
6. Confirm the Arweave transaction and retrieve it through more than one gateway
   before enabling mint.
7. Mint only the confirmed metadata URI. Record payment transaction, quote,
   upload transaction IDs, hashes, and mint transaction together.

Use x402 v2 through an adapter and pin exact package versions. Prefer an explicit
upfront payment flow for irreversible upload costs when the chosen facilitator
supports it. If only the default authorization flow is available, the job ledger
must prevent unpaid repeated fulfillment and reconcile settlement failures.
Facilitator-specific code stays behind an interface so a new operator can replace
it or self-host verification and settlement.

Do not put raw uploads or thumbnails in the application database. Temporary
staging objects receive short expiry. The durable record contains identifiers,
hashes, receipts, and canonical Arweave transaction IDs. Optimized derivatives
may be cached for speed, but public pages must always be reconstructible from the
canonical upload.

### 5. Complete Studio

- Durable draft state and upload/payment job ledger.
- Single-work upload, payment, confirmation, and mint.
- Series ZIP validation, deterministic manifest generation, resumable upload,
  and bounded mint batches.
- Collection deployment with preflight simulation and recorded deployment data.
- Collection dashboard, token management, metadata updates where the contract
  permits them, and public collection/token routes.
- Mainnet factory deployments and production indexer operations on Ethereum and
  Base.
- Shared auction creation and management workflow.

## Reconstruction contract

The database and subgraphs are disposable indexes. Recovery depends on these
versioned, public inputs:

- Chain IDs, contract addresses, deployment blocks, ABIs, and implementation
  versions in a checked-in deployment manifest.
- Deterministic indexer commands that scan from those deployment blocks.
- Database migrations and documented projections from chain events.
- Canonical Arweave transaction IDs and content hashes in token metadata and
  upload receipts.
- Gallery and editorial publication records exported as signed, versioned
  manifests to Arweave. Social reads the database for speed but can import these
  manifests on a fresh installation.
- Curator grants and publication audit records in exports; ownership recovery is
  anchored to the documented onchain owner or multisig.
- A repository command that creates an empty database, seeds manifests, replays
  chain history, imports editorial records, and verifies referenced media.

Derived data such as rankings, cached thumbnails, search indexes, reaction
counts, and resolved names may be rebuilt or omitted. Private user data and
moderation secrets are intentionally outside the public reconstruction set.

## Required recovery drill

Before either production launch, run the recovery process in an empty environment
with no production database, Vercel Blob, Alchemy NFT index, or primary gateway
cache. Success means the environment can:

- enumerate deployed collections and minted tokens;
- reconstruct auctions, listings, bids, purchases, and settlement state;
- resolve canonical media through alternate Arweave gateways;
- restore published exhibitions and curator attribution;
- render stable artwork and listing URLs;
- identify any records that cannot be reconstructed and state why.

Publish the drill procedure and its resulting verification report in the repo.

## Cutover gates

1. **Inventory:** every public MVP route, API, cron, webhook, and admin function is
   marked ported, redirected, or retired.
2. **Transactions:** bid, buy, list, cancel, and settle pass mainnet smoke tests
   with replacement and failure recovery.
3. **Administration:** role enforcement, exhibition publication, curator controls,
   and audit history are production-ready.
4. **Studio:** a new artist can pay for permanent media, deploy a collection, mint,
   manage it, and create an auction without operator subsidy.
5. **Reconstruction:** the clean-room recovery drill passes.
6. **Shadow:** Social reads production data in parallel with MVP and discrepancies
   are measured before DNS/deployment changes.
7. **Cutover:** preserve URLs, retain a rollback deployment, and keep MVP available
   until transaction and webhook parity is observed in production.

## Immediate implementation sequence

1. Create the MVP route and operational parity inventory.
2. Finish SIWE sessions and the shared role/audit model.
3. Port listing details and one complete auction lifecycle into Social.
4. Build the curator directory and exhibition publication workflow.
5. Implement an x402 + Arweave proof on test networks with one file, one metadata
   record, idempotent retry, and simulated failure after payment.
6. Use the proven upload job in Studio's single and series mint flows.
7. Add deployment manifests, replay tooling, editorial exports, and the recovery
   command before mainnet Studio launch.
