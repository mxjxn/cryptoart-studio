# Cryptoart Social — implementation brief

## Confirmed product decisions

Build `apps/social` as a web Farcaster client focused on approved art channels, drawing from the web application in `~/workspace/farcaster-client`. Mobile/Expo is outside the initial scope.

Approved channels:

- cryptoart
- degen-art
- gen-art
- ai-art
- gifart
- veg
- kismet

The default feed prioritizes popular casts published within the last 24 hours, interlaced with latest casts. Likes from FID **4905** carry extra algorithmic weight. More weighted casters can be configured later. Curation means a Farcaster like; it does not require a special endorsement action.

Casts associated with active Cryptoart listings receive additional priority. Resolve listing links and embeds into artwork and auction cards, ultimately supporting bidding directly inside the cast.

Standalone marketplace activity belongs between casts, with artwork and concise descriptive copy. User examples:

> bob.eth outbid someone.eth on Ragnarok by artiste.eth with a 0.2 eth bid

> artiste.eth listed 10 copies of Brambles 2 for sale for 0.003 eth each

The composer offers the approved channels and defaults to `cryptoart`. Replies remain attached to their existing conversations.

Galleries should have native, social-friendly 2D views. Reuse useful work from `such-gallery-elixir`; full 3D rooms and live gallery chat are deferred. Studio manages collections and supplies shared artwork and marketplace capabilities.

## Proposed tuning defaults — not additional user decisions

- Begin with a repeatable two-popular/one-latest cast pattern.
- Insert at most one marketplace activity card after six casts when eligible activity exists.
- Deduplicate by cast hash across both cast lanes.
- Use a fixed request/snapshot time to define the rolling 24-hour popular window.
- Start with a transparent engagement score based on likes, recasts, and replies; select numerical coefficients after inspecting real data distributions.
- Add configurable weighted-liker and active-listing boosts. Do not infer reputation from follower count.
- Count each weighted account's like once per cast. Remove its contribution when the like is removed.
- Preserve room for fresh casts without weighted likes or listings.
- Apply author/listing repetition limits and respect moderation, blocks, and mutes.
- Keep scoring reasons visible to developers so ranking can be evaluated and adjusted.

## Feed pipeline

1. Resolve and validate channel identifiers through the provider.
2. Collect popular-window and latest candidates from the approved channels.
3. Fetch sufficient reaction information to establish whether FID 4905 actually liked each cast. A provider's abbreviated liker preview is not proof of absence.
4. Parse supported Cryptoart URLs into chain, marketplace, and listing identity. Treat ambiguous references as links, not transaction instructions.
5. Resolve artwork, listing state, and payment-token details through existing marketplace/indexing capabilities.
6. Compute ranking, interlace the lanes, insert eligible marketplace activity, and deduplicate.
7. Return a stable feed snapshot or multi-source cursor that avoids gaps and repeats as upstream feeds change.

“Most popular” requires adequate candidate coverage: ranking only a small latest page is not equivalent to ranking the channel's last 24 hours. Verify provider capabilities and pagination before committing to the ingestion design.

Weighted likes affect the liked cast. They do not automatically boost every cast referencing the same artwork. Boosts cannot admit a cast from outside the approved channels.

## Marketplace activity semantics

- Namespace event identities by chain and source event identity; listing identifiers also include marketplace contract.
- Preserve immutable event facts separately from current listing state.
- Say “outbid” only when ordered bid history establishes the prior leader and a different bidder has replaced them. Otherwise say “placed a bid.”
- Resolve names where available and fall back to shortened addresses. Do not assume seller and artist are the same person.
- Format payment amounts using the actual token and decimals. Do not label every amount ETH.
- Verify quantity and per-sale semantics before claiming “N copies at X each.” Distinguish the initial listing event from currently remaining supply.
- Include artwork, time, relevant amount/quantity, and a link into the listing.
- Avoid inventing a historical finalization event from mutable status alone.
- Refresh transaction-critical state immediately before preparing an inline bid. The connected wallet explicitly confirms the transaction.

## Implementation sequence

### 1. Feed foundation and ranking preview

Establish the appropriate implementation branch and scaffold Social alongside MVP using the repository's existing conventions. Implement typed feed policy, source adapters, channel eligibility, weighted likes, popular/latest mixing, and explanatory ranking output. Connect real read data when development credentials are available. Clearly distinguish fixtures from live results.

Acceptance: approved-channel casts appear; popularity uses the correct window; FID 4905's verified likes change ranking; latest posts receive slots; pages avoid duplicates; source failures have honest empty/degraded states.

### 2. Artwork enrichment and activity cards

Resolve listing embeds and introduce illustrated bids, new listings, and purchases using existing subgraph and metadata capabilities. Support Ethereum and Base identities and amounts correctly. Reuse existing listing destinations initially.

Acceptance: a supported listing cast displays verified artwork/listing information; marketplace activity describes actual indexed events without inventing artists, outbid relationships, or prices.

### 3. Social actions and bidding inside casts

Integrate Farcaster authentication and approved posting authorization, channel-selectable composition defaulting to cryptoart, replies, likes, and recasts. Reuse transaction logic through an appropriate shared boundary to support wallet-confirmed bids inside casts.

Acceptance: posting uses the selected approved channel; social writes require the user's authorization; bidding checks current chain/listing state and updates its result. No automatic casts are published for blockchain activity.

### 4. Social galleries

Compare existing MVP curation records with Such Gallery's artwork/placement model and select a single authoritative gallery service before writing a second competing model. Build gallery previews, 2D detail pages, ordering, notes, and add-to-gallery actions. Galleries hold artwork independent of whether it is currently listed.

Acceptance: the same artwork can appear in galleries and marketplace cards, with current sale information attached when available. Collection management remains connected to Studio. 3D and room chat are not prerequisites.

## Existing integration findings

- The checked-out `apps/social` contains build artifacts and dependencies, but no tracked source.
- MVP already contains marketplace fetching, metadata enrichment, user resolution, follows, favorites, and notification machinery.
- Studio has collection APIs and wallet integration; several UI workflows remain placeholders.
- The Farcaster web reference is Vite/React with substantial shared hooks/data packages and assumptions about Farcaster's production backend. Reuse must account for those dependencies.
- Such Gallery has Ecto artwork/placement models, Cryptoart URL parsing, subgraph fetching, 2D LiveView surfaces, and room presence/chat. Its existing parser covers fewer URL variants than MVP's helpers.
- Such Gallery management is primarily LiveView, and its wallet accounts do not yet include Farcaster identity linkage. A shared gallery API and identity integration require implementation.

Older repository plans are background material. Their channel-first rules, special curator actions, automatic cast broadcasting, and deployment assumptions are not newly authorized by this brief.

## Engineering checks before live integration

Verify the intended base branch, dependency compatibility, available development configuration, provider channel/reaction access, event pagination, and listing transaction reuse. Keep credentials in local/server configuration. Develop alongside the current auctionhouse and preserve existing production routes; production cutover is a later milestone.

No further product decision is required to start the feed foundation. Mixing ratios, coefficients, refresh intervals, and gallery service ownership can be resolved through implementation and evaluation without another broad planning round.
