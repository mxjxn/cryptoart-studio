# NFT Gallery - FAQ & Quick Reference

## Frequently Asked Questions

### General Questions

**Q: What is an NFT Gallery?**  
A: It's an NFT that owns its own wallet (via Tokenbound/ERC-6551) where you can deposit and display other NFTs. Think of it as a digital art gallery that exists on-chain.

**Q: Why would I want an NFT Gallery?**  
A: To curate and showcase your NFT collection, create themed exhibitions, or build a permanent portfolio that lives on the blockchain forever (via Arweave).

**Q: What's the difference between this and just displaying NFTs on my profile?**  
A: Your gallery is an NFT itself, is portable (can be sold/transferred with all its contents), and is permanently hosted on Arweave. It's also composable - other apps can display your gallery.

---

### Pricing & Membership

**Q: How much does it cost to mint a gallery?**  
A: Proposed pricing:
- Members (Hypersub holders): $15 (~0.005 ETH)
- Non-members: $30 (~0.01 ETH)

**Q: Are there any recurring fees?**  
A: No! You pay once to mint. Arweave hosting is permanent (included in mint price).

**Q: How do I get the membership discount?**  
A: Hold an active Hypersub membership NFT for the Cryptoart channel. The discount is checked automatically when you mint.

**Q: Can I mint multiple galleries?**  
A: Yes! Mint as many as you want. Each is a separate NFT with its own wallet.

---

### Technical Questions

**Q: What blockchain is this on?**  
A: Base (Ethereum L2) - low fees, fast transactions.

**Q: What tokens can I deposit?**  
A: ERC-721 (standard NFTs) and ERC-1155 (semi-fungible tokens).

**Q: Is there a limit to how many NFTs I can put in a gallery?**  
A: Yes, configurable at mint time. Proposed: 10-20 NFTs per gallery. This keeps file sizes reasonable for Arweave.

**Q: Can I remove NFTs after depositing them?**  
A: Yes! As the gallery owner, you can eject NFTs at any time.

**Q: What happens if I sell/transfer my gallery NFT?**  
A: The new owner gets full control of the gallery and all NFTs inside it. The Tokenbound wallet ownership automatically transfers with the NFT.

**Q: Is my gallery wallet secure?**  
A: Yes. The wallet is restricted to only safe operations (deposit/eject NFTs). It cannot make arbitrary transactions or approve tokens.

---

### Arweave Questions

**Q: What is Arweave?**  
A: A permanent storage network. Upload once, available forever. No monthly fees.

**Q: Why use Arweave instead of IPFS?**  
A: IPFS requires "pinning" services to keep files available (recurring cost). Arweave is truly permanent after one payment.

**Q: Can I update my gallery HTML after minting?**  
A: Yes! You can regenerate and upload new HTML when you add/remove NFTs.

**Q: How big are the HTML files?**  
A: Estimated 500KB - 2MB depending on how many NFTs and whether images are embedded or linked.

**Q: What if Arweave goes down?**  
A: Arweave is decentralized and replicated across many nodes. Even if some nodes go down, your data remains available. It's designed for 200+ year permanence.

---

### Gallery Features

**Q: Can people view my gallery without owning the NFT?**  
A: Yes! Galleries are public by default. Anyone can view at such.gallery/[your-gallery-id].

**Q: Can I make a private gallery?**  
A: Not in V1, but planned for V2 (token-gated access).

**Q: How do people navigate my gallery?**  
A: Swipe left/right between NFTs, tap to zoom, swipe up to see details and metadata.

**Q: Can I rearrange the order of NFTs?**  
A: Yes! Drag and drop to reorder in the management interface.

**Q: Can I showcase NFTs that are for sale?**  
A: Yes! If your NFT is listed on a marketplace, we'll show the listing info (view-only, no transactions).

**Q: Can multiple people collaborate on one gallery?**  
A: Not in V1. Each gallery has one owner (the NFT holder). Multi-owner galleries are planned for V2.

---

### Integration Questions

**Q: Can I embed my gallery on my website?**  
A: Planned for V2. Initially, you can share a direct link.

**Q: Can I share my gallery as a Farcaster Frame?**  
A: Yes! Planned feature - cast your gallery with a preview frame.

**Q: Will my gallery show up on OpenSea?**  
A: Yes! The gallery NFT itself will be visible on OpenSea and other marketplaces.

**Q: Can I use NFTs from different chains?**  
A: V1 will focus on Base only. Cross-chain support planned for V2.

---

### Development Questions

**Q: When will this launch?**  
A: Target: 6-8 weeks from project start (pending resource allocation).

**Q: Will there be a testnet version to try?**  
A: Yes! Beta testing on Base testnet before mainnet launch.

**Q: Is the code open source?**  
A: Yes! Part of the cryptoart-studio monorepo on GitHub.

**Q: Can I contribute?**  
A: Yes! Contributions welcome. See CONTRIBUTING.md (to be created).

**Q: Will there be an API?**  
A: Yes! REST API for querying galleries, NFTs, and generating HTML.

---

## Quick Reference

### Contract Addresses (TBD)

```
Network: Base Mainnet
Gallery NFT Contract: 0x... (to be deployed)
Tokenbound Registry: 0x... (existing)
Tokenbound Implementation: 0x... (custom or standard)
Hypersub Contract: 0x... (need from project owner)
```

### API Endpoints

```
POST   /api/gallery/mint              - Mint new gallery
POST   /api/gallery/[id]/deposit      - Deposit NFT
POST   /api/gallery/[id]/eject        - Eject NFT
GET    /api/gallery/[id]              - Get gallery details
GET    /api/gallery/[id]/nfts         - List NFTs in gallery
PUT    /api/gallery/[id]/arrange      - Rearrange NFTs
GET    /api/gallery/user/[address]    - User's galleries
POST   /api/gallery/[id]/generate     - Generate Arweave HTML
GET    /api/membership/check          - Check membership
```

### Gas Estimates (Base)

```
Mint Gallery: ~$2-3
Deposit NFT: ~$0.50-1
Eject NFT: ~$0.50-1
Update URI: ~$0.20-0.50
```

### Arweave Costs

```
Small HTML (<500KB): ~$0.005
Medium HTML (500KB-1MB): ~$0.01
Large HTML (1-2MB): ~$0.02
```

---

## Troubleshooting

### "Insufficient payment" error
- Check if you're a Hypersub member (should get 50% discount)
- Ensure you're sending enough ETH for the mint price
- Check gas estimates - transaction might need more gas

### "Gallery at capacity" error
- Your gallery is full. Either eject some NFTs or mint a new gallery.
- Capacity was set when you minted (default: 10-20 NFTs)

### "NFT not found in gallery wallet" error
- The NFT transfer might not have confirmed yet. Wait a bit and retry.
- Verify the transaction succeeded on the block explorer
- Check you're using the correct contract address and token ID

### "Operation not allowed" error
- Gallery wallets can only deposit/eject NFTs, no other operations
- This is a security feature to protect your assets
- Use a regular wallet for other transactions

### Gallery HTML not loading
- Arweave uploads can take 10-30 minutes to propagate
- Check the transaction ID on arweave.net
- Try regenerating the HTML if it's been >1 hour

---

## Best Practices

### Curating Your Gallery
1. **Choose a theme**: Focus on a specific artist, style, or collection
2. **Tell a story**: Arrange NFTs in an order that creates a narrative
3. **Mix it up**: Combine different styles and mediums
4. **Update regularly**: Keep your gallery fresh with new additions

### Managing Your Gallery
1. **Set appropriate capacity**: Don't max out if you want to add more later
2. **Back up metadata**: Download NFT metadata before ejecting
3. **Test on testnet**: Try features on testnet before using real assets
4. **Monitor gas prices**: Deposit/eject during low gas times

### Security
1. **Verify addresses**: Always double-check contract addresses
2. **Use hardware wallets**: For high-value NFTs
3. **Small test first**: Deposit a low-value NFT first to test
4. **Keep ownership safe**: The gallery NFT controls everything inside

---

## Resources

### Documentation
- [Full Plan](./NFT_GALLERY_PLAN.md) - Complete specification
- [Technical Guide](./NFT_GALLERY_TECHNICAL.md) - Developer documentation
- [Summary](./NFT_GALLERY_SUMMARY.md) - Executive summary

### External Links
- [Tokenbound SDK](https://github.com/tokenbound/sdk)
- [ERC-6551 Standard](https://eips.ethereum.org/EIPS/eip-6551)
- [Arweave Docs](https://docs.arweave.org/)
- [Base Network](https://base.org/)

### Community
- [Cryptoart Farcaster Channel](https://warpcast.com/~/channel/cryptoart)
- [Hypersub](https://hypersub.xyz/s/cryptoart)
- [Discord](https://discord.gg/...) (TBD)

---

## Glossary

**ERC-6551 / Tokenbound**: A standard that allows NFTs to own wallets and hold assets.

**TBA (Token Bound Account)**: The wallet owned by your gallery NFT.

**Arweave**: Permanent, decentralized storage network.

**Hypersub**: Subscription NFT platform for memberships.

**Base**: Ethereum Layer 2 (L2) network with low fees.

**ERC-721**: Standard NFT (one unique token).

**ERC-1155**: Semi-fungible token standard (can have multiple copies).

**Permaweb**: Arweave's permanent web (websites/files that live forever).

**such.gallery**: The domain for this NFT gallery platform.

---

*Last updated: 2025-12-08*
