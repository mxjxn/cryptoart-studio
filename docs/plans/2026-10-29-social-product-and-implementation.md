# Cryptoart Social product and implementation plan

Updated October 29, 2026. Implementation handoff for Cursor, based on product decisions made with the owner.

Cryptoart Social combines looking at art, collecting, curating, selling, and conversation. Cryptoart Studio is the dedicated portal for minting and artist operations. The immediate goal is to connect existing marketplace, exhibition, and social foundations into one coherent public experience while completing Studio separately.

## Decision precedence

This plan supersedes conflicting product directions in `apps/social/PLAN.md`, `docs/CRYPTOART_PLATFORM_ROADMAP.md`, and older feed/composer specifications. Preserve their useful engineering requirements where compatible.

Latest clarification: **text-only posts are allowed; existing Farcaster channels are omitted.** Do not implement the current approved-channel allowlist as the product's feed scope. The exact Hypersnap discovery and ingestion mechanism still needs verification.

This handoff defines work to implement later. It does not authorize deploying contracts, changing production, or removing the existing application during implementation.

## Confirmed product decisions

### Two applications

- **cryptoart.social:** the public social and market application. Browse artwork, collect, post, curate exhibitions, and list existing NFTs.
- **cryptoart.studio:** collection deployment, minting, collection management, and advanced artist tools, including future LSSVM liquidity-pool and STP subscription-NFT tooling.
- Social's mint/create-art entry point forwards artists to Studio. Posting and curating remain distinct Social actions.

People may arrive to look at art and possibly collect; curate and possibly earn a curation fee; list existing art and possibly sell; or mint and list through Studio with access to additional artist tools.

### Three main tabs

| Tab | Content | Ordering |
| --- | --- | --- |
| Featured | Manually featured high-quality exhibitions/galleries, plus recent listings from the auctionhouse and supported market contracts | Editorial exhibition placement; recent listing section |
| Market | All public listings and exhibitions available through supported integrations | Chronological |
| Feed | Social posts combined with listings and exhibitions | Ranked and interlaced to avoid excessive repetition of a content type |

Market is an exhaustive chronological view, not the curated entrance described in older plans. Feed is a mixed stream, not a page grouping posts into separate thematic sections. Featured provides editorial discovery.

### Posts and artwork

Posts may contain text alone. They may also contain an NFT attachment and commentary, such as a collector discussing a work they own or a viewer appreciating someone else's work.

The composer accepts chain, contract address, and token ID, resolves metadata and media, and attaches the artwork to the post. Artwork must already be minted. Ownership and an active sale are not requirements for discussing or curating a work.

Do not restrict all posts to captions on an existing Cryptoart subject. The imported composer is a potential implementation source; the final interface must support the product behavior above.

### Curations and exhibitions

A curation can be a lightweight recommendation of several works or a developed exhibition with context and deliberate presentation. Exhibition quality depends on the curator's effort; do not require a high-effort exhibition workflow for every selection.

Any minted artwork is eligible, including work that is not for sale. Adding discovered work from the feed should be easy. Manually feature selected high-quality exhibitions on Featured. Curation is a distinct authored selection, not merely a like on a cast.

Curators may earn fees where supported by the market and attribution mechanism. Fee rates, eligibility, attribution rules, and payout behavior remain to be specified and verified against contracts.

### Hypersnap

Use Hypersnap for the social integration. Omit existing Farcaster channels. Replace the historical Farcaster notification integration; notification types and delivery behavior require a separate implementation decision.

Reading an identity or connecting a wallet does not grant permission to publish social messages. Verify the actual Hypersnap authentication, signing, publishing, and discovery paths before connecting write actions.

## Current repository baseline

The baseline below comes from source inspection on branch `feat/social-web-foundation`, starting at `fb8afc9`. Code presence does not establish runtime readiness or live deployment status.

| Area | Existing foundation | Remaining work |
| --- | --- | --- |
| Social application | `apps/social` contains an imported web client with composer, cast presentation, conversations, and profiles | Integrate authentication and social writes; remove upstream product assumptions |
| Hypersnap reads | `apps/social/web/src/cryptoart/server.ts` reads a configured public Hypersnap HTTP endpoint | Replace existing-channel candidate selection with the intended scope; verify provider behavior and production hosting |
| Feed | Ranking, retained snapshots, pagination, marketplace cards | Mix posts, listings, and exhibitions; add diversity rules and persistent ingestion where needed |
| Artwork discovery | `domain.ts`, `assetDiscovery.ts`, and `YourItems.tsx` supply artwork identity, inventory, lookup/import, and metadata foundations | Reuse lookup in the composer and exhibition editor without requiring ownership |
| Market | Existing MVP marketplace routes and new Social reader in `marketClient.ts`; shared `packages/marketplace` utilities | Native transaction integration, comprehensive supported-source coverage, and route parity |
| Exhibitions | Legacy MVP curation APIs; newer exhibition tables, placements, and publication slots in `packages/db/src/schema.ts` | Choose authoritative service, connect real reads/writes, migrate where necessary, replace fixtures |
| Studio | App scaffold, identity/session infrastructure, collections API, and media upload page | Deployment wizard is a placeholder; complete minting and management flows |
| Mint contracts | `packages/collection-contracts` contains factory, single/batch minting, extensions, royalties, tests, and deployment script | Validate contracts and dependencies; verify deployments and configuration |
| Collection indexing | `packages/collection-indexer` watches factories, discovers collections, scans events, and resolves metadata | Harden processing and recovery, configure factories, verify running service and catch-up |
| Older indexing | `packages/creator-core-indexer` exists | Contains placeholder extension event signatures; do not assume it is complete |
| Advanced tools | LSSVM dependency/configuration references; MVP STP membership purchase/access logic | Verify external deployments and build artist-facing tools; membership support is not a subscription creation portal |

The Social API adapters currently live in Vite development/preview middleware. Deploying only the frontend bundle will not provide those APIs.

Repository notes describe a Sepolia factory and leave Base/Ethereum mainnet factory deployment as future work. Verify current on-chain state rather than treating the notes as a deployment registry.

The checkout has uninitialized contract gitlinks and an LSSVM gitlink without a matching `.gitmodules` entry. Repair reproducible dependency setup before relying on contract builds or repository-wide checks.

## Shared data and service boundaries

Use chain ID, normalized contract address, and token ID as the artwork identity across posts, exhibition placements, listings, and Studio links. Keep token IDs lossless; avoid JavaScript number conversion for arbitrary NFT IDs. Artwork exists independently of its current market state.

Namespace listings by chain, market contract, and listing ID. Namespace activity by its source event identity. Keep social post hashes separate from artwork and listing identities.

Build shared resolvers and domain contracts rather than copying entire Next.js UI components into the Vite application. Reuse metadata/media handling, identity checks, market lifecycle rules, and transaction preparation where appropriate.

Resolve which exhibition service owns records before implementing another parallel gallery store. Reconcile legacy listing-based curation with the newer artwork-based exhibition tables and any live such.gallery service.

## Implementation sequence

### Phase 1 Verify dependencies and establish integration contracts

1. Read this plan and relevant existing engineering plans. Reconcile conflicting feed/composer assumptions before coding.
2. Repair submodule setup and install dependencies using the separate Social workspace instructions.
3. Establish an executable baseline for Social, Studio, marketplace APIs, and relevant tests. Record failures separately from new regressions.
4. Inventory supported chains, market contracts, mint factories, deployment blocks, RPCs, databases, indexers, and API hosts. Verify live state using read-only checks.
5. Verify Hypersnap capabilities for identity, authentication/signing, text posts, NFT/link embeds, replies, reactions, follows, discovery, and notifications. Distinguish supported operations from imported client assumptions.
6. Choose the authoritative exhibition service and define public read, curator write, and editorial publication interfaces.

Acceptance: a reproducible local setup and a capability/deployment matrix identifying working integrations and concrete gaps. No existing-channel feed dependency is carried forward by accident.

### Phase 2 Build the public navigation and read experience

1. Add Featured, Market, and Feed tabs with stable URLs and browser back/forward behavior.
2. Connect Featured to real editorial exhibition placements and recent supported-market listings.
3. Build Market as a chronological merge of listings and published exhibitions with stable cross-source pagination.
4. Build the Feed rendering contract for posts, listings, and exhibitions. Keep ranking and mixing policy separate from presentation.
5. Provide native artwork, exhibition, and listing destinations with explicit loading, empty, partial-data, and error states.
6. Link the mint entry point to Studio. Preserve relevant chain/artwork context where supported.

Acceptance: each tab has its agreed purpose, real data is distinguishable from development fixtures, browsing works without signing in, and navigation does not break existing transaction links.

### Phase 3 Connect posting and artwork attachments

1. Complete verified user sessions and the required social publishing authorization.
2. Support text-only posts and posts with resolved NFT attachments.
3. Allow direct chain/contract/token entry and a shortcut from discovered artwork or wallet inventory.
4. Show resolved media and metadata before submission; handle invalid tokens, unsupported chains, failed metadata, and retries explicitly.
5. Verify replies, reactions, and other exposed social actions end to end. Hide or label unfinished actions rather than presenting false success.
6. Ensure published posts can be discovered by this app's intended feed mechanism.

Acceptance: a user can publish text, discuss a minted NFT they do not own, follow the resulting post into a conversation, and see their authorized actions persist after refresh.

### Phase 4 Complete curation and editorial management

1. Create, edit, order, publish, and unpublish artwork selections using the authoritative exhibition service.
2. Add eligible minted artwork directly from feed cards, artwork pages, or explicit lookup. A listing must be optional.
3. Provide titles, descriptions, captions, and sequencing to support more developed exhibitions without making every field mandatory for a casual selection.
4. Connect published exhibitions to Market and Feed. Restrict editorial Featured placement to the appropriate roles.
5. Define and implement curator fee attribution only after verifying supported settlement behavior. Show earnings claims only when the mechanism is real.

Acceptance: someone can curate an unlisted NFT, publish the exhibition, discover it in the public app, and have an authorized editor feature it. Removing a listing does not remove the artwork from the exhibition.

### Phase 5 Complete collecting and selling

1. Port or share supported listing creation, bidding, buying, cancellation, and settlement flows from MVP.
2. Refresh transaction-critical state before wallet confirmation and handle pending, rejected, reverted, replaced, and confirmed transactions.
3. Update listing cards and artwork availability from authoritative market state.
4. Apply the chosen curator attribution mechanism consistently across supported purchase paths.
5. Verify quantity, currency, chain, contract, and market-specific semantics. Do not generalize auctionhouse behavior to every market integration.

Acceptance: supported sell/collect journeys complete end to end and remain discoverable across tabs without stale prices or misleading availability.

### Phase 6 Complete Studio and production operations

Studio work can proceed alongside Social once its contract and media boundaries are established.

1. Finish artist-funded media storage, draft recovery, and confirmation behavior using the existing media work.
2. Complete collection deployment, single/batch minting, collection management, and context links back to Social listing/discovery.
3. Harden factory discovery and event scanning before mainnet reliance. In particular, prevent swallowed event failures from advancing cursors past unprocessed records; verify replay, idempotency, reorg handling, and metadata recovery.
4. Verify or deploy required factories through a separately authorized deployment step, configure indexers, and prove a new collection/mint reaches the public read model.
5. Build LSSVM pool creation/management and STP subscription creation/management as separately scoped Studio integrations.
6. Host Social APIs outside development middleware, add operational monitoring, and meet existing cutover and durability requirements before replacing MVP.

Acceptance: an artist can create a collection, mint, see the indexed work, and enter a Social listing flow. Advanced tools have their own acceptance checks and do not imply readiness merely because an ABI or membership page exists.

## Feed and chronology recommendations

These are implementation defaults to validate, not additional owner decisions:

- Start Market newest first. Use listing creation time and exhibition first publication time; ordinary edits should not silently bump records.
- Use deterministic tie breakers and a stable snapshot or equivalent cursor across the merged sources.
- Rank Feed for relevance and recency, then apply configurable content-type and author repetition limits. Do not require an exact ratio when a source has little content.
- Avoid adjacent duplicate artwork presentations where practical while preserving distinct commentary and market information.
- Preserve a reading session when new content arrives; offer refresh rather than jumping content.
- Apply moderation and viewer blocks/mutes to eligible candidates. Editorial featuring and algorithmic scores are separate controls.
- Keep market event facts distinct from current sale state. An older post must not imply an artwork is still available.

## Open decisions

Resolve these at the relevant implementation boundary; do not silently treat older plans as the answer.

1. Which Hypersnap identities, streams, or app-maintained records define Feed eligibility without existing channels? Are future app-owned channel keys desired? Do not deploy channel NFTs from the older proposal by default.
2. Is Featured the default landing tab? This was suggested, not explicitly confirmed.
3. What exact routes and final labels should the tabs and actions use?
4. Does Market include ended listings in its default chronology, and does republishing an exhibition create a new entry?
5. Which chains and market integrations are launch requirements?
6. What attachment cardinality and embed format should posts support? One NFT is the first required case; multiple NFTs are not yet specified.
7. What are curator fee rates, eligible sales, attribution duration, competing referrals, and payout rules?
8. What are the publication/access rules for curators? Reassess inherited membership gating rather than assuming it remains desired.
9. Which Hypersnap notifications replace historical notifications, and how are they delivered?
10. Which advanced Studio tools are required for initial release versus later releases?

## Verification and implementation handoff

Use targeted behavioral tests for merged pagination and ordering, feed diversity/deduplication, NFT identity and metadata lookup, authorization, exhibition publication, transaction lifecycle, and indexer recovery. Verify the three-tab experience at desktop and mobile widths and exercise the core journeys manually against real configured services.

Do not claim end-to-end readiness from mocks or code presence alone. Retain MVP until production API hosting, route/transaction parity, data migration, durability, and cutover checks pass. Existing security and recovery requirements remain applicable.

Start implementation with Phase 1, then deliver a small vertical slice: open Social, browse the tabs, resolve a minted work, publish a post about it, and retrieve that post through the intended Hypersnap integration. Extend that slice to curation and commerce before expanding advanced Studio tools.

## Repository references

- `apps/social/README.md` and `apps/social/PLAN.md`
- `apps/social/web/src/cryptoart/` for feed, market, identity, discovery, and exhibition presentation
- `apps/mvp/src/app/api/curation/` and existing marketplace routes
- `apps/studio/README.md` and `apps/studio/src/app/`
- `packages/identity`, `packages/marketplace`, `packages/media`, and `packages/db`
- `packages/collection-contracts` and `packages/collection-indexer`
- `docs/CRYPTOART_PLATFORM_ROADMAP.md`
- `docs/CUTOVER_AND_DURABILITY_PLAN.md`
- `docs/MARKET_GESTURES_AND_GALLERY_MODEL.md`
- `docs/SUCH_GALLERY_READ_API_PLAN.md`
- `docs/plans/cryptoart-studio-status.md`
