# NFT Gallery Implementation Plan (such.gallery)

## Executive Summary

This document outlines the plan to create NFT galleries using the Tokenbound SDK for cryptoart.social. Users can mint galleries for a set price (with 50% discount for hypersub members), deposit NFTs into gallery wallets, and display them through dynamically generated HTML galleries hosted on Arweave.

## Project Overview

### Core Concept
- **Product**: NFT-based galleries with tokenbound accounts as internal wallets
- **Domain**: such.gallery
- **Target**: Cryptoart community members on Farcaster
- **Key Feature**: Each gallery is an NFT that owns its own wallet (ERC-6551/Tokenbound account)

### Key Technologies
- **Frontend**: Next.js 15 + TypeScript + Farcaster Mini App SDK
- **Smart Contracts**: Tokenbound SDK (ERC-6551), ERC-721 gallery NFTs
- **Storage**: Arweave (permanent storage for gallery HTML/metadata)
- **Database**: PostgreSQL + Drizzle ORM (gallery metadata, user data)
- **Membership**: Hypersub integration (discount validation)
- **Chain**: Base (likely, following existing app patterns)

---

## Architecture

### 1. Smart Contract Layer

#### Gallery NFT Contract
- **Type**: ERC-721 (one gallery = one NFT)
- **Features**:
  - Mintable with price (e.g., 0.01 ETH)
  - Hypersub membership discount (50% off)
  - Token URI points to Arweave for metadata/gallery HTML
  - Tokenbound account creation on mint
  - Gallery configuration (capacity, theme, etc.)

#### Tokenbound Account (TBA)
- **Purpose**: Internal wallet for each gallery NFT
- **Allowed Operations** (for security):
  - `depositNFT` - Deposit ERC-721 to gallery
  - `deposit1155` - Deposit ERC-1155 to gallery
  - `ejectNFT` - Remove ERC-721 from gallery
  - `eject1155` - Remove ERC-1155 from gallery
  - `transferETH` - (Optional) Allow ETH transfers out
  - Block: Arbitrary contract calls, token approvals

#### Hypersub Integration
- **Contract**: Existing hypersub contract on Base
- **Integration Points**:
  - `balanceOf(address)` check during minting
  - Apply 50% discount if balance > 0
  - Cache membership status (packages/cache pattern)

### 2. Backend/API Layer

#### Database Schema (packages/db)

```typescript
// Gallery table
export const galleries = pgTable('galleries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenId: bigint('token_id', { mode: 'number' }).notNull().unique(),
  ownerAddress: text('owner_address').notNull(),
  tbaAddress: text('tba_address').notNull(), // Tokenbound account
  name: text('name').notNull(),
  description: text('description'),
  capacity: integer('capacity').notNull().default(10), // Max NFTs
  arweaveId: text('arweave_id'), // Arweave transaction ID
  theme: text('theme').default('default'), // Gallery theme/layout
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Gallery NFTs table (NFTs in each gallery)
export const galleryNfts = pgTable('gallery_nfts', {
  id: uuid('id').primaryKey().defaultRandom(),
  galleryId: uuid('gallery_id').notNull().references(() => galleries.id),
  contractAddress: text('contract_address').notNull(),
  tokenId: text('token_id').notNull(), // string for large numbers
  tokenType: text('token_type').notNull(), // 'ERC721' | 'ERC1155'
  amount: integer('amount').default(1), // for ERC1155
  position: integer('position').notNull(), // Display order
  metadata: jsonb('metadata'), // Cached NFT metadata
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (table) => ({
  galleryIdx: index('gallery_nfts_gallery_idx').on(table.galleryId),
  uniqueNft: index('gallery_nfts_unique_idx').on(
    table.galleryId, 
    table.contractAddress, 
    table.tokenId
  ),
}));

// Gallery views/analytics
export const galleryStats = pgTable('gallery_stats', {
  galleryId: uuid('gallery_id').primaryKey().references(() => galleries.id),
  views: integer('views').default(0),
  likes: integer('likes').default(0),
  lastViewedAt: timestamp('last_viewed_at'),
});
```

#### API Endpoints (apps/such-gallery/src/app/api/)

```
POST   /api/gallery/mint              - Mint new gallery
POST   /api/gallery/[id]/deposit      - Deposit NFT to gallery
POST   /api/gallery/[id]/eject        - Eject NFT from gallery
GET    /api/gallery/[id]              - Get gallery details
GET    /api/gallery/[id]/nfts         - Get NFTs in gallery
PUT    /api/gallery/[id]/arrange      - Rearrange NFT positions
GET    /api/gallery/user/[address]    - Get galleries by owner
POST   /api/gallery/[id]/generate     - Generate/update Arweave HTML
GET    /api/membership/check          - Check hypersub membership
POST   /api/gallery/[id]/refresh      - Refresh NFT metadata
```

### 3. Frontend Layer

#### App Structure (apps/such-gallery/)

```
apps/such-gallery/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Home/Browse galleries
│   │   ├── gallery/
│   │   │   ├── [id]/page.tsx           # Gallery detail/viewer
│   │   │   └── mint/page.tsx           # Mint new gallery
│   │   ├── my-galleries/page.tsx       # User's galleries
│   │   └── api/                        # API routes (above)
│   ├── components/
│   │   ├── gallery/
│   │   │   ├── GalleryViewer.tsx       # Main gallery display
│   │   │   ├── GalleryGrid.tsx         # Grid layout for NFTs
│   │   │   ├── GalleryCarousel.tsx     # Swipe navigation
│   │   │   ├── NFTDetail.tsx           # Zoom/detail view
│   │   │   └── NFTDepositModal.tsx     # Deposit NFT modal
│   │   ├── mint/
│   │   │   ├── MintGalleryForm.tsx     # Mint form
│   │   │   └── MembershipBanner.tsx    # Discount banner
│   │   └── shared/                     # Shared components
│   ├── lib/
│   │   ├── tokenbound/                 # Tokenbound SDK wrapper
│   │   ├── arweave/                    # Arweave client
│   │   ├── contracts/                  # Contract ABIs/clients
│   │   └── gallery/                    # Gallery utilities
│   ├── hooks/
│   │   ├── useGallery.ts               # Gallery data hooks
│   │   ├── useMembership.ts            # Membership check
│   │   └── useTokenbound.ts            # TBA operations
│   └── templates/
│       └── gallery-html/               # HTML templates for Arweave
├── public/
│   ├── gallery-templates/              # Static gallery templates
│   └── assets/                         # Images, fonts, etc.
└── package.json
```

#### Gallery Viewer UI Features

**Navigation**:
- Thumb swipe left/right to navigate between NFTs
- Tap to zoom in on current NFT
- Swipe up/scroll down for details panel
- Grid view toggle

**NFT Detail Panel** (swipe up):
- NFT name, collection, token ID
- Description and attributes
- Listing info (if for sale on marketplace)
- Links to marketplace, original collection
- Owner information

**Gallery Controls** (for owner):
- Add/remove NFTs
- Rearrange positions (drag & drop)
- Edit gallery info
- Share gallery
- Generate/update Arweave HTML

### 4. Arweave Integration

#### Purpose
- Permanent, immutable hosting of gallery HTML
- No recurring costs (pay once, host forever)
- Gallery NFT metadata points to Arweave

#### Implementation
```typescript
// lib/arweave/client.ts
class ArweaveClient {
  async uploadGalleryHTML(galleryId: string, html: string): Promise<string>
  async generateGalleryHTML(gallery: Gallery, nfts: NFT[]): string
  async uploadMetadata(metadata: GalleryMetadata): Promise<string>
}
```

#### HTML Generation
- Server-side rendering of gallery HTML
- Embeds NFT images/metadata inline (or via IPFS/Arweave links)
- Standalone HTML file with CSS/JS bundled
- Responsive design for mobile/desktop
- Interactive navigation (swipe, zoom, etc.)

#### Costs
- **Arweave Storage**: ~$0.01 per MB (one-time)
- **Estimated Gallery Size**: 500KB - 2MB (depends on assets)
- **Cost per Gallery**: ~$0.01 - $0.02
- **Minting Cost**: Cover Arweave in mint price + profit margin

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Set up project structure, contracts, and basic backend

- [ ] Initialize such-gallery Next.js app
  - Copy structure from apps/auctionhouse
  - Configure dependencies (Next.js 15, Wagmi, etc.)
  - Set up Tailwind CSS, component library
- [ ] Install and configure Tokenbound SDK
  - Add `@tokenbound/sdk` dependency
  - Create wrapper utilities in `lib/tokenbound/`
  - Test TBA creation and operations
- [ ] Design and deploy smart contracts
  - Gallery NFT contract (ERC-721)
  - Minting logic with price
  - Hypersub discount integration
  - TBA creation on mint
  - Access control for TBA operations
- [ ] Set up database schema
  - Create migration for gallery tables
  - Test DB operations
- [ ] Set up Arweave client
  - Install Arweave SDK
  - Create upload utilities
  - Test HTML upload

### Phase 2: Core Features (Week 3-4)
**Goal**: Implement minting, deposit/eject, and basic gallery display

- [ ] Mint Gallery Flow
  - Mint form UI
  - Membership check (hypersub)
  - Price calculation (with discount)
  - Transaction handling
  - TBA creation
  - Database record creation
- [ ] NFT Deposit/Eject
  - Deposit NFT modal
  - Contract interaction (TBA)
  - Metadata fetching (Alchemy/NFT API)
  - Database updates
  - Eject functionality
- [ ] Gallery Viewer (Basic)
  - Gallery detail page
  - NFT grid display
  - Basic navigation
  - Metadata display

### Phase 3: Advanced UI (Week 5-6)
**Goal**: Implement full gallery viewer with swipe, zoom, and details

- [ ] Gallery Viewer (Advanced)
  - Swipe navigation (Swiper.js or custom)
  - Zoom functionality
  - Detail panel (swipe up)
  - Smooth animations
  - Responsive design
- [ ] Gallery Management
  - My Galleries page
  - Edit gallery info
  - Rearrange NFTs (drag & drop)
  - Delete gallery (optional)
- [ ] Browse/Discover
  - Gallery listing page
  - Search and filters
  - Featured galleries
  - User profiles

### Phase 4: Arweave & Polish (Week 7-8)
**Goal**: Generate HTML galleries, upload to Arweave, polish UI

- [ ] HTML Gallery Generation
  - Server-side template rendering
  - Embed NFT images/metadata
  - Bundle CSS/JS
  - Test standalone HTML
- [ ] Arweave Upload
  - Upload HTML on gallery creation
  - Update on NFT changes (optional)
  - Update NFT metadata URI
  - Handle upload errors
- [ ] Polish & Testing
  - UI/UX improvements
  - Error handling
  - Loading states
  - Mobile optimization
  - E2E testing
- [ ] Documentation
  - User guide
  - Developer documentation
  - API documentation

---

## Critical Unanswered Questions

### 1. Tokenbound SDK & Security

**Q1.1**: How do we restrict Tokenbound account operations to only safe functions (deposit/eject)?
- **Options**:
  - A) Use Tokenbound's built-in permission system (if available)
  - B) Create a custom "Gallery Manager" contract that acts as trusted forwarder
  - C) Implement function whitelisting in TBA implementation
- **Impact**: Security critical - prevents malicious actions via TBA
- **Need**: Review Tokenbound SDK documentation and examples

**Q1.2**: Can Tokenbound accounts hold ERC-1155 tokens?
- **Assumption**: Yes, since they're standard EOA-like accounts
- **Need**: Verify with Tokenbound docs or test contract

**Q1.3**: What are the gas costs for TBA operations?
- **Need**: Deploy test contracts and measure gas usage
- **Impact**: Affects pricing model

### 2. Pricing & Economics

**Q2.1**: What should the mint price be?
- **Factors**:
  - TBA creation gas cost (~$1-2?)
  - Arweave storage (~$0.01-0.02)
  - Profit margin
  - User accessibility
- **Proposal**: Start with 0.005 ETH (~$15) for members, 0.01 ETH (~$30) for non-members
- **Need**: User research, competitor analysis

**Q2.2**: Should we charge for updating gallery HTML on Arweave?
- **Options**:
  - A) Free updates (include in mint price)
  - B) Small fee per update (e.g., $1)
  - C) Limited free updates (e.g., 5), then paid
- **Trade-off**: Revenue vs. user experience
- **Recommendation**: Free updates, covered by mint price

**Q2.3**: Revenue model for ongoing operations?
- **Costs**: API calls, database hosting, indexing
- **Options**:
  - A) All covered by mint price (one-time)
  - B) Optional premium features (analytics, custom domains)
  - C) Platform fee on secondary sales (OpenSea-style)
- **Need**: Financial modeling

### 3. Hypersub Integration

**Q3.1**: Which hypersub contract(s) should we check?
- **Need**: Get contract address(es) from project maintainer
- **Impact**: Core feature - 50% discount

**Q3.2**: How do we handle expired memberships?
- **Options**:
  - A) Check at mint time only (historical snapshot)
  - B) Ongoing checks for features (e.g., priority support)
- **Recommendation**: Check at mint only (simplest)

**Q3.3**: Should we support multiple membership tiers with different discounts?
- **Options**:
  - A) Single tier (50% discount)
  - B) Multiple tiers (e.g., bronze 25%, silver 50%, gold 75%)
- **Trade-off**: Complexity vs. flexibility
- **Recommendation**: Start with single tier

### 4. Arweave & Storage

**Q4.1**: How do we handle large galleries with many high-res NFTs?
- **Challenges**:
  - HTML file size
  - Load times
  - Cost
- **Options**:
  - A) Lazy load images via IPFS/Arweave links
  - B) Limit gallery capacity (e.g., 10-20 NFTs)
  - C) Thumbnail previews, full-res on click
- **Recommendation**: Lazy load + capacity limit

**Q4.2**: Should we upload gallery HTML to Arweave immediately or on-demand?
- **Options**:
  - A) On mint (gallery starts empty)
  - B) On first NFT deposit
  - C) Manual trigger by owner
- **Trade-off**: UX vs. cost optimization
- **Recommendation**: On first NFT deposit or manual trigger

**Q4.3**: How do we handle Arweave upload failures?
- **Options**:
  - A) Retry automatically
  - B) Fail mint (revert)
  - C) Allow mint, upload later (asynchronous)
- **Recommendation**: Asynchronous upload with retry logic

**Q4.4**: Do we need to store the full generated HTML in our database or just the Arweave ID?
- **Recommendation**: Just Arweave ID + gallery config (regenerate if needed)

### 5. User Experience

**Q5.1**: Should galleries be public by default or require opt-in?
- **Recommendation**: Public by default (it's an NFT, already public on-chain)

**Q5.2**: How do users share galleries?
- **Options**:
  - A) Direct link to such.gallery/[id]
  - B) Farcaster frame (cast with preview)
  - C) Embeddable iframe
- **Recommendation**: All of the above

**Q5.3**: Should we support collaborative galleries (multiple owners)?
- **Complexity**: High (requires multi-sig or shared access)
- **Recommendation**: V2 feature

**Q5.4**: What happens when a gallery NFT is sold/transferred?
- **Behavior**: TBA ownership follows NFT (automatic)
- **Data**: Update gallery owner in database
- **Need**: Indexer to track transfers

### 6. Technical Details

**Q6.1**: Which chain(s) should we support?
- **Options**:
  - A) Base only (aligns with existing apps)
  - B) Multiple chains (Ethereum, Optimism, etc.)
- **Recommendation**: Base initially, multichain in V2

**Q6.2**: How do we index gallery events?
- **Options**:
  - A) Subgraph (The Graph)
  - B) Custom indexer (like packages/creator-core-indexer)
- **Recommendation**: Custom indexer (reuse existing infrastructure)

**Q6.3**: How do we fetch NFT metadata for deposited NFTs?
- **Options**:
  - A) Alchemy NFT API
  - B) Reservoir API
  - C) Direct contract calls + IPFS
- **Recommendation**: Alchemy (already used in repo)

**Q6.4**: Should we support marketplace listings within the gallery viewer?
- **Integration**: Link to LSSVM pools, auctionhouse, OpenSea
- **Recommendation**: Yes, as data-only (no transactions in gallery)

### 7. Development & Deployment

**Q7.1**: Should such-gallery be in the monorepo or separate?
- **Current State**: Empty directory exists in apps/such-gallery
- **Recommendation**: Keep in monorepo (shared packages, easier to maintain)

**Q7.2**: What's the deployment strategy?
- **Options**:
  - A) Vercel (like other apps)
  - B) Custom hosting
- **Recommendation**: Vercel (consistent with other apps)

**Q7.3**: How do we handle contract upgrades?
- **Options**:
  - A) Immutable contracts (no upgrades)
  - B) Upgradeable proxies (UUPS/Transparent)
- **Recommendation**: Start immutable, add upgradeability if needed

**Q7.4**: What's the testing strategy?
- **Smart Contracts**: Foundry tests
- **Frontend**: React Testing Library + E2E (Playwright?)
- **API**: Integration tests
- **Need**: Set up testing infrastructure

---

## Cost Analysis

### One-Time Costs (Development)
- Development time: 6-8 weeks (1-2 developers)
- Smart contract audits: $5,000-15,000 (optional but recommended)
- Design/UX: TBD (in-house or contract)

### Per-Gallery Costs
- Gas (mint + TBA creation): ~$2-5 (Base)
- Arweave storage: ~$0.01-0.02
- **Total**: ~$2-5 per gallery

### Ongoing Costs (Monthly)
- Vercel hosting: $20-100/month (Pro plan)
- Database (Supabase/Postgres): $25-100/month
- RPC calls: $50-200/month (Alchemy/Infura)
- Arweave uploads: $10-50/month (depends on volume)
- **Total**: ~$105-450/month

### Revenue Model
- Mint price: $15-30 per gallery
- Expected mints: 50-100/month initially
- Monthly revenue: $750-3,000
- **Break-even**: 10-50 mints/month

---

## Technical Dependencies

### Smart Contracts
- **Tokenbound SDK**: `@tokenbound/sdk` - ^0.4.0
- **OpenZeppelin Contracts**: `@openzeppelin/contracts` - ^5.0.0
- **Foundry**: For contract development and testing

### Frontend
- **Next.js**: ^15.0.0
- **React**: ^18.3.1
- **Wagmi**: ^2.14.0 (Web3 interactions)
- **Viem**: ^2.23.0 (Ethereum client)
- **Farcaster SDK**: `@farcaster/miniapp-sdk` - ^0.1.6
- **Swiper.js**: ^11.0.0 (carousel/swipe)
- **Radix UI**: Component primitives

### Backend/Database
- **Drizzle ORM**: ^0.36.4
- **PostgreSQL**: (existing shared database)
- **Redis**: (optional, for caching)

### Storage & APIs
- **Arweave**: `arweave` - ^1.15.0
- **Alchemy SDK**: `alchemy-sdk` - ^3.4.0 (NFT metadata)
- **IPFS**: (optional, for image hosting)

---

## Risk Assessment

### High Risk
1. **Tokenbound SDK Maturity**: SDK is relatively new, may have bugs/limitations
   - *Mitigation*: Thorough testing, start with testnet
2. **Security**: TBA access control is critical
   - *Mitigation*: Careful contract design, audits, limited initial capacity
3. **Gas Costs**: Could be higher than expected on L1
   - *Mitigation*: Use Base or other L2

### Medium Risk
1. **Arweave Costs**: Could exceed estimates for large galleries
   - *Mitigation*: Capacity limits, lazy loading
2. **User Adoption**: Will users want to pay for galleries?
   - *Mitigation*: Start with low price, strong UX
3. **Metadata Fetching**: NFT APIs can be slow/unreliable
   - *Mitigation*: Caching, graceful degradation

### Low Risk
1. **Development Timeline**: Well-scoped project
2. **Technical Feasibility**: All components are proven tech
3. **Integration**: Reuses existing infrastructure

---

## Success Metrics

### Launch (Month 1)
- 50+ galleries minted
- 10+ active creators
- 500+ NFTs deposited
- 1,000+ gallery views

### Growth (Month 3)
- 200+ galleries minted
- 50+ active creators
- 2,000+ NFTs deposited
- 10,000+ gallery views
- 5+ community features/requests implemented

### Mature (Month 6)
- 500+ galleries minted
- 100+ active creators
- 5,000+ NFTs deposited
- 50,000+ gallery views
- Profitable (revenue > costs)

---

## Next Steps

### Immediate (This Week)
1. **Answer Critical Questions**: Get stakeholder input on pricing, hypersub contract, etc.
2. **Technical Spike**: Test Tokenbound SDK with sample contracts
3. **Design Review**: Create wireframes/mockups for gallery viewer
4. **Resource Allocation**: Assign developers, set timeline

### Short-Term (Next 2 Weeks)
1. **Finalize Specs**: Lock in requirements based on Q&A
2. **Set Up Project**: Initialize such-gallery app in monorepo
3. **Contract Development**: Start smart contract work
4. **Database Schema**: Implement gallery tables

### Medium-Term (Month 1)
1. **MVP Development**: Build core features (mint, deposit, view)
2. **Testing**: Deploy to testnet, internal testing
3. **Arweave Integration**: Implement HTML generation and upload
4. **Documentation**: Write user guides and API docs

### Long-Term (Month 2+)
1. **Beta Launch**: Release to small group of users
2. **Feedback & Iteration**: Improve based on user feedback
3. **Mainnet Launch**: Deploy to production
4. **Marketing**: Announce to Cryptoart community
5. **V2 Planning**: Collaborative galleries, advanced features

---

## Open Questions for Stakeholder Review

Please review and provide feedback on the following:

1. **Pricing**: Is $15 (members) / $30 (non-members) reasonable?
2. **Hypersub Contract**: What's the contract address(es) to check for membership?
3. **Gallery Capacity**: Should we limit galleries to 10, 20, or unlimited NFTs?
4. **Chain**: Confirm Base as the target chain?
5. **Arweave Budget**: Are we comfortable with ~$50-100/month for Arweave uploads initially?
6. **Timeline**: Is 6-8 weeks realistic for MVP launch?
7. **Security**: Should we budget for a smart contract audit ($5k-15k)?
8. **Features**: Any must-have features not covered in this plan?

---

## Appendix

### Related Documentation
- [Tokenbound SDK](https://github.com/tokenbound/sdk)
- [ERC-6551 Standard](https://eips.ethereum.org/EIPS/eip-6551)
- [Arweave Documentation](https://docs.arweave.org/)
- [Hypersub Documentation](https://hypersub.xyz/docs)

### Reference Implementations
- Tokenbound Examples: https://github.com/tokenbound/examples
- Gallery Inspiration: Foundation, SuperRare, Zora

### Team Contacts
- Project Lead: [TBD]
- Smart Contract Dev: [TBD]
- Frontend Dev: [TBD]
- Designer: [TBD]

---

*Document Version: 1.0*  
*Last Updated: 2025-12-08*  
*Author: GitHub Copilot AI Agent*
