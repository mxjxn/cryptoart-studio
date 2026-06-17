# NFT Gallery (such.gallery) - Executive Summary

## What We're Building

An NFT gallery platform where users can:
1. **Mint a gallery** (ERC-721 NFT with its own wallet via Tokenbound/ERC-6551)
2. **Deposit NFTs** into the gallery wallet (ERC-721 & ERC-1155)
3. **View galleries** through beautiful, swipeable HTML interfaces
4. **Share galleries** permanently on Arweave (permaweb)

**Special Feature**: Hypersub members get 50% discount on minting!

---

## Key Features

### For Users
- 🎨 **Mint Your Gallery**: Pay once (e.g., $15 for members, $30 for non-members)
- 🖼️ **Curate Your Collection**: Deposit up to 10-20 NFTs from any collection
- 📱 **Beautiful Display**: Swipe navigation, zoom, detailed info
- 🔗 **Permanent Hosting**: Gallery HTML on Arweave (no monthly fees!)
- 🔒 **Secure**: Gallery wallet only allows safe operations (no arbitrary calls)

### Technical Highlights
- **Tokenbound (ERC-6551)**: Each gallery NFT owns a smart contract wallet
- **Restricted Operations**: Only deposit/eject NFTs (no risky transactions)
- **Arweave Storage**: One-time payment for permanent hosting
- **Hypersub Integration**: Automated membership discount verification
- **Farcaster Native**: Built as a Farcaster Mini App

---

## Architecture

```
User → Mints Gallery NFT → Creates Tokenbound Account (TBA)
                          ↓
            TBA holds NFTs (user deposits)
                          ↓
       Gallery metadata + HTML → Arweave
                          ↓
            such.gallery displays gallery
```

### Smart Contracts
1. **Gallery NFT Contract** (ERC-721)
   - Minting with price + hypersub discount
   - Token URI points to Arweave
   - Creates TBA on mint

2. **Tokenbound Account** (per gallery)
   - Whitelisted functions only: depositNFT, ejectNFT, deposit1155, eject1155
   - Blocks: Arbitrary calls, approvals, etc.

### Frontend (Next.js)
- Gallery viewer with swipe navigation
- Mint gallery flow
- Manage NFTs (deposit/eject)
- Generate & upload to Arweave

### Backend
- PostgreSQL database (gallery metadata)
- Alchemy API (NFT metadata)
- Arweave client (permanent storage)

---

## Cost Breakdown

### Per Gallery (One-Time)
- **Mint Price**: $15 (members) / $30 (non-members)
- **Actual Costs**:
  - Gas (Base L2): ~$2-5
  - Arweave upload: ~$0.01-0.02
  - Total: ~$2-5
- **Profit per mint**: ~$10-25

### Ongoing (Monthly)
- Hosting (Vercel): $20-100
- Database: $25-100
- RPC calls: $50-200
- Arweave uploads: $10-50
- **Total**: ~$105-450/month
- **Break-even**: 10-50 mints/month

---

## Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1: Foundation** | 2 weeks | Project setup, contracts, database, Arweave client |
| **Phase 2: Core Features** | 2 weeks | Mint flow, deposit/eject, basic viewer |
| **Phase 3: Advanced UI** | 2 weeks | Swipe navigation, zoom, details, management |
| **Phase 4: Launch** | 2 weeks | HTML generation, Arweave upload, testing, docs |
| **Total** | **8 weeks** | MVP ready for beta launch |

---

## Critical Questions (Need Answers!)

### 1. Pricing
- **Proposed**: $15 (members) / $30 (non-members)
- **Question**: Is this price point acceptable?

### 2. Hypersub Integration
- **Need**: Contract address(es) to check for membership
- **Question**: Single tier (50% discount) or multiple tiers?

### 3. Gallery Capacity
- **Options**: 10 NFTs, 20 NFTs, or unlimited?
- **Trade-off**: Cost vs. flexibility
- **Recommendation**: Start with 10-20 limit

### 4. Tokenbound Security
- **Critical**: How to restrict TBA to safe operations only?
- **Options**:
  - Custom "Gallery Manager" contract
  - Tokenbound permission system
  - Function whitelisting
- **Need**: Research Tokenbound SDK capabilities

### 5. Arweave Upload
- **When**: On mint, on first NFT deposit, or manual trigger?
- **Recommendation**: On first NFT deposit or manual trigger

### 6. Chain Selection
- **Proposed**: Base (L2, low fees)
- **Question**: Confirm Base as target chain?

### 7. Smart Contract Audit
- **Cost**: $5,000-15,000
- **Question**: Should we budget for an audit?
- **Recommendation**: Yes, for security-critical Tokenbound integration

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Tokenbound SDK bugs | High | Thorough testing, start with testnet |
| TBA security | High | Careful design, audit, limited initial capacity |
| Gas costs too high | Medium | Use Base L2 |
| Arweave costs exceed estimates | Medium | Capacity limits, lazy loading |
| Low user adoption | Medium | Low price, strong UX, community marketing |

---

## Success Metrics

### Month 1 (Launch)
- 50+ galleries minted
- 10+ active creators
- 500+ NFTs deposited

### Month 3 (Growth)
- 200+ galleries
- 50+ active creators
- 2,000+ NFTs deposited

### Month 6 (Mature)
- 500+ galleries
- 100+ active creators
- 5,000+ NFTs deposited
- **Profitable** (revenue > costs)

---

## Next Steps

1. **This Week**: Get stakeholder answers to critical questions above
2. **Week 1-2**: Technical spike (test Tokenbound), finalize specs, start contracts
3. **Week 3-4**: Build mint flow, deposit/eject, basic viewer
4. **Week 5-6**: Advanced UI, gallery management
5. **Week 7-8**: Arweave integration, testing, launch prep
6. **Week 9**: Beta launch to small group
7. **Week 10+**: Iterate, improve, mainnet launch

---

## Key Decisions Needed

### Immediate
- [ ] Approve pricing model
- [ ] Provide hypersub contract address(es)
- [ ] Approve Base as target chain
- [ ] Approve 10-20 NFT capacity limit
- [ ] Budget for smart contract audit ($5k-15k)

### Short-Term
- [ ] Finalize timeline and resource allocation
- [ ] Review UI/UX mockups (once created)
- [ ] Approve Arweave integration approach
- [ ] Decide on additional features for V1 vs. V2

---

## Resources

- **Full Plan**: See [NFT_GALLERY_PLAN.md](./NFT_GALLERY_PLAN.md) for detailed technical specification
- **Tokenbound**: https://github.com/tokenbound/sdk
- **ERC-6551**: https://eips.ethereum.org/EIPS/eip-6551
- **Arweave**: https://docs.arweave.org/
- **Domain**: such.gallery (assumed registered)

---

*For questions or to discuss this plan, please reach out to the project team.*
