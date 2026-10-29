# Cryptoart Social — implementation brief

## Decisions as of 2026-10-28

Hypersnap is the only network. Existing Farcaster channels stay on the Farcaster side and are not a Cryptoart surface. The channel filter and channel browser come out. The app is channel-less until it has its own channel keys.

A cast is a caption on one subject the app already has: an artwork, a listing, or a gallery. The caption may be empty. The only embed is that subject's canonical Cryptoart URL. There is no image upload and no free-text cast. Replies stay in the thread under that subject. The imported `/compose` route is not the write UI.

The app feed is the index of those casts. It is not a Hypersnap channel listing. Hypersnap does not give a newest-first listing of a channel, and a channel-less cast has no channel to list. Publishing a cast records its hash and subject here. That record is what the feed and the subject page show.

Later, two NFTs can become the channel keys. Do not deploy them now.

- A mainnet NFT is the parent for casts about mainnet works, listings, and galleries.
- A Base NFT is the parent for casts about Base works, listings, and galleries.
- The cast's parent URL is that NFT's canonical Cryptoart URL. The caption and the single subject embed stay as they are.
- Until those NFTs exist, top-level casts omit a channel parent.

## Confirmed product decisions

Build `apps/social` as the public Cryptoart exhibition, market, and conversation. The imported Farcaster web client remains a source for reading threads. It is not the product shell. Mobile/Expo is outside the initial scope.

The default feed prioritizes popular casts published within the last 24 hours, interlaced with latest casts. Likes from FID **4905** carry extra algorithmic weight. More weighted casters can be configured later. Curation means a like; it does not require a special endorsement action.

Casts associated with active Cryptoart listings receive additional priority. Resolve listing links and embeds into artwork and auction cards, ultimately supporting bidding directly inside the cast.

Standalone marketplace activity belongs between casts, with artwork and concise descriptive copy. User examples:

> bob.eth outbid someone.eth on Ragnarok by artiste.eth with a 0.2 eth bid

> artiste.eth listed 10 copies of Brambles 2 for sale for 0.003 eth each

Compose opens on the artwork, listing, or gallery. It does not offer a channel picker. Replies remain attached to their existing conversations.

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

1. Read casts from the app's own subject index. A cast is eligible when its single embed is a canonical artwork, listing, or gallery URL.
2. Collect popular-window and latest candidates from that index.
3. Fetch sufficient reaction information to establish whether FID 4905 actually liked each cast. A provider's abbreviated liker preview is not proof of absence.
4. Parse supported Cryptoart URLs into chain, marketplace, and listing identity. Treat ambiguous references as links, not transaction instructions.
5. Resolve artwork, listing state, and payment-token details through existing marketplace/indexing capabilities.
6. Compute ranking, interlace the lanes, insert eligible marketplace activity, and deduplicate.
7. Return a stable feed snapshot or multi-source cursor that avoids gaps and repeats as upstream feeds change.

“Most popular” requires adequate candidate coverage: ranking only a small latest page is not equivalent to ranking the channel's last 24 hours. Verify provider capabilities and pagination before committing to the ingestion design.

Weighted likes affect the liked cast. They do not automatically boost every cast referencing the same artwork. Boosts cannot admit a cast that lacks a Cryptoart subject.

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

### 3. Compose

1. Remove the channel filter from the feed. One stream, ranked as it is now.
2. Define a compose intent: subject kind, canonical URL, chain, ids, and an optional caption. Reject a second embed, an uploaded image, or a missing subject.
3. Replace the Cast link with a caption sheet on the artwork, listing, or gallery page. The imported composer stays unused.
4. Keep signing off this origin. The sheet holds the intent. A separate signer origin submits it after a one-time custody import and a gasless app-key add. No account registration until the Hypersnap identity contract is forked. No seed phrase in this app.
5. On submit, send one Hypersnap cast with that single embed and no channel parent. Record the hash and subject in the app feed index.
6. Show that record on the subject page and in the feed.

Acceptance: Cast never opens `/compose`. A cast without a Cryptoart subject cannot be submitted. The feed shows captions on works, listings, and galleries. The signer is the only place a phrase can be entered, and it discards the phrase after the app key exists.

### 4. Social actions and bidding inside casts

Add replies, likes, and recasts on subject threads. Reuse transaction logic through a shared boundary to support wallet-confirmed bids inside casts.

Acceptance: social writes require the user's authorization; bidding checks current chain/listing state and updates its result. No automatic casts are published for blockchain activity.

### 5. Social galleries

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
