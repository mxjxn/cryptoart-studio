# LLM User Support Guide for Cryptoart.social

This document provides comprehensive guidance for LLMs answering user questions, providing support, and troubleshooting common issues on cryptoart.social.

## Quick Reference

### Common Questions

**Getting Started**:
- How do I create an auction?
- Do I need membership to bid?
- How do I connect my wallet?

**Auctions**:
- How do I place a bid?
- What happens if I'm outbid?
- When does an auction end?

**Membership**:
- How much does membership cost?
- What do I get with membership?
- How do I purchase membership?

**Troubleshooting**:
- My transaction failed
- I can't see my auction
- My bid didn't go through

### Quick Answers

- **Membership Cost**: 0.5 ETH (STP v2 NFT)
- **Membership Required**: Only for creating auctions, not for bidding
- **Chain**: Base Mainnet (Chain ID: 8453)
- **Payment**: ETH or ERC20 tokens
- **Support**: Check documentation or community channels

---

## Detailed Sections

### Getting Started Guide

#### Creating Your First Auction

**Prerequisites**:
1. Farcaster account
2. Wallet connected (via Farcaster mini-app)
3. Membership NFT (STP v2, 0.5 ETH)
4. NFT to sell (ERC721 or ERC1155)

**Steps**:
1. Navigate to `/create` page
2. Connect wallet if not already connected
3. Select NFT from wallet
4. Choose listing type (Auction, Fixed Price, etc.)
5. Configure pricing and timing
6. Submit transaction
7. Wait for confirmation

**Common Issues**:
- **"Not a member" error**: Purchase membership first
- **"Token not approved"**: Approve marketplace contract
- **"Insufficient balance"**: Ensure you have ETH for gas

#### Bidding on Auctions

**Prerequisites**:
1. Farcaster account
2. Wallet connected
3. ETH or ERC20 tokens for bidding

**Steps**:
1. Browse active auctions on homepage
2. Click on auction to view details
3. Enter bid amount
4. Confirm transaction
5. Wait for confirmation

**Common Issues**:
- **"Bid too low"**: Must meet minimum increment
- **"Auction ended"**: Check end time
- **"Transaction failed"**: Check gas and balance

#### Purchasing Fixed Price Listings

**Steps**:
1. Find fixed price listing
2. Click "Purchase" button
3. Confirm transaction
4. Receive NFT immediately

**Common Issues**:
- **"Sold out"**: All items already purchased
- **"Insufficient funds"**: Need exact amount
- **"Transaction failed"**: Check gas and balance

### Feature How-Tos

#### How to Create Different Listing Types

**Individual Auction**:
1. Select "Auction" listing type
2. Set reserve price (minimum bid)
3. Set start and end times
4. Configure minimum bid increment
5. Set extension interval (optional)

**Fixed Price**:
1. Select "Fixed Price" listing type
2. Set price per item
3. Set total available (for editions)
4. Set start and end times

**Dynamic Price**:
1. Select "Dynamic Price" listing type
2. Requires lazy minting
3. Price determined by bonding curve
4. Price changes with each sale

**Offers Only**:
1. Select "Offers Only" listing type
2. Buyers make offers
3. Seller reviews and accepts
4. No direct purchase option

#### How to Place Bids

**Basic Bidding**:
1. View auction details
2. Enter bid amount (must exceed current bid + minimum increment)
3. Click "Place Bid"
4. Confirm transaction
5. Wait for confirmation

**Increasing Existing Bid**:
1. If you're already the highest bidder
2. Enter new bid amount
3. Click "Increase Bid"
4. Confirm transaction

**Bid Requirements**:
- Must meet or exceed reserve price (first bid)
- Must exceed current bid by minimum increment
- Must have sufficient ETH/tokens
- Must have gas for transaction

#### How to Make Offers

**Making an Offer**:
1. Find auction or offers-only listing
2. Enter offer amount
3. Click "Make Offer"
4. Confirm transaction
5. Funds held in escrow until accepted/rejected

**Rescinding Offers**:
- Auction offers: Can rescind before first bid
- Offers-only: Can rescind after listing ends + 24 hours
- Seller can rescind others' offers after listing ends

#### How to Use Profiles

**Viewing Your Profile**:
1. Click profile dropdown (top right)
2. Select "Profile"
3. View created auctions, collected NFTs, active bids

**Viewing Others' Profiles**:
1. Click on artist/collector name
2. Or visit `/user/[username]`
3. View their auctions and collection

**Profile Features**:
- Created auctions (as seller)
- Collected NFTs (as buyer)
- Active bids (current highest bids)
- User information (Farcaster profile)

#### How to Use Notifications

**Viewing Notifications**:
1. Click notification bell icon
2. View unread notifications
3. Mark as read by clicking

**Notification Types**:
- New bid on your auction
- You've been outbid
- Auction ending soon
- Purchase confirmation
- Offer accepted/rejected

**Managing Preferences**:
- Visit notification settings
- Enable/disable notification types
- Set preferences for different events

### Troubleshooting Common Issues

#### Transaction Issues

**Transaction Failed**:
1. Check you have sufficient ETH for gas
2. Verify transaction parameters are correct
3. Check network (should be Base Mainnet)
4. Try increasing gas limit
5. Wait a few minutes and retry

**Transaction Pending**:
1. Check transaction on BaseScan
2. Wait for confirmation (usually < 1 minute on Base)
3. Refresh page if needed
4. Check wallet for confirmation

**"Insufficient Funds" Error**:
1. Check ETH balance for gas
2. Check token balance for payment
3. Ensure you have enough for bid + gas
4. Consider using ERC20 token if ETH balance low

#### Auction Issues

**Auction Not Showing**:
1. Check if auction is active (not finalized)
2. Verify auction hasn't ended
3. Refresh page
4. Check if auction was cancelled

**Can't Place Bid**:
1. Verify auction is still active
2. Check bid meets minimum increment
3. Ensure sufficient funds
4. Check if auction accepts bids (not offers-only)

**Bid Not Showing**:
1. Wait for transaction confirmation
2. Refresh page
3. Check transaction on BaseScan
4. Verify bid was successful

#### Wallet Issues

**Wallet Not Connecting**:
1. Ensure you're in Farcaster mini-app context
2. Check wallet extension is installed
3. Try refreshing page
4. Check Farcaster app permissions

**Wrong Network**:
1. Should be Base Mainnet (Chain ID: 8453)
2. Switch network in wallet
3. Add Base network if not available
4. Verify network in wallet settings

**Wallet Disconnected**:
1. Reconnect wallet
2. Check Farcaster app connection
3. Verify wallet permissions
4. Try disconnecting and reconnecting

#### Membership Issues

**"Not a Member" Error**:
1. Verify you own STP v2 membership NFT
2. Check NFT is in connected wallet
3. Verify NFT balance > 0
4. Try refreshing membership status

**Membership Not Showing**:
1. Wait for transaction confirmation
2. Refresh page
3. Check NFT in wallet
4. Verify NFT contract address

**Can't Purchase Membership**:
1. Ensure sufficient ETH (0.5 ETH + gas)
2. Check you're on Base Mainnet
3. Verify contract address is correct
4. Try transaction again

#### Display Issues

**Images Not Loading**:
1. Check NFT metadata is valid
2. Verify image URL is accessible
3. Try refreshing page
4. Check network connection

**Data Not Updating**:
1. Refresh page
2. Wait for subgraph sync (may take a few minutes)
3. Check if data is cached
4. Try clearing cache

**Profile Not Loading**:
1. Check Farcaster username is correct
2. Verify user exists on Farcaster
3. Try using wallet address instead
4. Refresh page

### Membership & Access

#### Membership Requirements

**What is Membership?**:
- STP v2 NFT (0.5 ETH)
- Required to create auctions
- Not required for bidding or purchasing
- One-time purchase, lifetime access

**How to Purchase**:
1. Navigate to `/membership` page
2. Click "Mint Pass" button
3. Confirm transaction (0.5 ETH)
4. Wait for confirmation
5. Membership NFT appears in wallet

**Membership Benefits**:
- Create auctions
- List NFTs for sale
- Access to creator features
- Verified creator status

**Membership Verification**:
- On-chain verification via NFT balance
- Automatic check when creating auction
- No manual approval needed
- Instant verification

#### Access Levels

**Without Membership**:
- Browse auctions
- Place bids
- Purchase fixed price listings
- Make offers
- View profiles
- Cannot create auctions

**With Membership**:
- All above features
- Create auctions
- List NFTs for sale
- Access creator dashboard

### Transaction Help

#### Understanding Transaction Types

**Creating Auction**:
- Non-payable transaction (no ETH sent)
- Requires token approval first
- Gas cost: ~100,000 - 200,000 gas
- Confirmation time: < 1 minute

**Placing Bid**:
- Payable transaction (ETH sent with bid)
- Gas cost: ~100,000 - 150,000 gas
- Confirmation time: < 1 minute
- Previous bidder automatically refunded

**Purchasing**:
- Payable transaction (ETH sent with purchase)
- Gas cost: ~100,000 - 150,000 gas
- Confirmation time: < 1 minute
- NFT transferred immediately

**Making Offer**:
- Payable transaction (ETH sent with offer)
- Gas cost: ~80,000 - 120,000 gas
- Confirmation time: < 1 minute
- Funds held in escrow

#### Gas Fees

**Base Network**:
- Low gas fees (typically < $0.10)
- Fast confirmation (< 1 minute)
- L2 scaling solution

**Estimating Gas**:
- Wallet shows gas estimate before transaction
- Usually accurate on Base
- Can adjust gas limit if needed

**Gas Optimization Tips**:
- Batch transactions when possible
- Use Base network (low fees)
- Avoid peak times if possible
- Check gas prices before transacting

#### Transaction Status

**Pending**:
- Transaction submitted to network
- Waiting for confirmation
- Usually confirms in < 1 minute

**Confirmed**:
- Transaction included in block
- Changes reflected on-chain
- May take a few minutes to appear in UI

**Failed**:
- Transaction reverted
- No changes made
- Gas still consumed
- Check error message for reason

### Best Practices

#### For Artists

**Creating Successful Auctions**:
1. Set realistic reserve prices
2. Choose appropriate listing type
3. Set reasonable end times
4. Provide good artwork metadata
5. Share auction on Farcaster

**Pricing Strategy**:
- Research similar artworks
- Consider market conditions
- Start with reasonable reserve
- Use dynamic pricing for limited editions

**Marketing Your Auction**:
- Share on Farcaster
- Use cast embeds
- Engage with community
- Update profile regularly

#### For Collectors

**Bidding Strategy**:
1. Research artwork and artist
2. Set maximum bid amount
3. Monitor auction closely
4. Bid strategically (not too early)
5. Be ready to increase if outbid

**Purchasing Tips**:
- Verify artwork authenticity
- Check artist profile
- Review auction terms
- Ensure sufficient funds

**Building Collection**:
- Follow favorite artists
- Track active bids
- Organize collection in profile
- Engage with community

#### For All Users

**Security Best Practices**:
1. Never share private keys
2. Verify contract addresses
3. Double-check transaction details
4. Use hardware wallet for large amounts
5. Keep software updated

**Wallet Safety**:
- Use reputable wallet
- Enable 2FA if available
- Keep recovery phrase secure
- Verify transactions before signing

**Community Engagement**:
- Follow artists you like
- Share interesting auctions
- Engage in discussions
- Help other users

### FAQ

#### General Questions

**Q: What is cryptoart.social?**
A: A Farcaster mini-app for creating and bidding on NFT auctions, built on Base Mainnet.

**Q: Do I need Farcaster to use it?**
A: Yes, it's a Farcaster mini-app and requires a Farcaster account.

**Q: What blockchain does it use?**
A: Base Mainnet (Chain ID: 8453), an Ethereum L2.

**Q: How much does it cost to use?**
A: Free to browse and bid. 0.5 ETH for membership (required to create auctions). Gas fees for transactions.

#### Auction Questions

**Q: How do I create an auction?**
A: Purchase membership (0.5 ETH), then navigate to `/create` and follow the steps.

**Q: What listing types are available?**
A: Individual Auction, Fixed Price, Dynamic Price, and Offers Only.

**Q: Can I cancel an auction?**
A: Yes, if no bids have been placed (for sellers). Admins can cancel anytime.

**Q: What happens if my auction doesn't sell?**
A: Token is returned to you when auction ends or is cancelled.

#### Bidding Questions

**Q: Do I need membership to bid?**
A: No, membership is only required to create auctions.

**Q: What happens if I'm outbid?**
A: Your previous bid is automatically refunded to your wallet.

**Q: Can I increase my bid?**
A: Yes, place a new bid higher than the current highest bid.

**Q: When does an auction end?**
A: At the specified end time, or extended if bid placed within extension interval.

#### Membership Questions

**Q: How much does membership cost?**
A: 0.5 ETH (one-time purchase).

**Q: What do I get with membership?**
A: Ability to create auctions and list NFTs for sale.

**Q: Is membership transferable?**
A: Yes, it's an NFT that can be transferred or sold.

**Q: Do I need membership to bid?**
A: No, membership is only for creating auctions.

#### Technical Questions

**Q: Why is my transaction pending?**
A: Transactions usually confirm in < 1 minute on Base. Check BaseScan for status.

**Q: Why did my transaction fail?**
A: Common reasons: insufficient gas, insufficient funds, invalid parameters. Check error message.

**Q: Why can't I see my auction?**
A: Check if auction is active, refresh page, or verify transaction was successful.

**Q: Why are images not loading?**
A: Check NFT metadata, verify image URL, or try refreshing page.

### Support Resources

#### Documentation
- **README**: `README.md` - Setup and overview
- **Writing Guide**: `LLM_WRITING.md` - Content guidelines
- **Developer Guide**: `LLM_DEVELOPERS.md` - Technical docs
- **Marketing Guide**: `LLM_MARKETING.md` - Feature descriptions

#### External Resources
- **Base Network**: https://base.org
- **Farcaster**: https://farcaster.xyz
- **BaseScan**: https://basescan.org - Transaction explorer
- **Auctionhouse Contracts**: `../../packages/auctionhouse-contracts/CAPABILITIES.md`

#### Community
- **Farcaster Channel**: cryptoart channel
- **Support**: Check documentation or community channels
- **Updates**: Follow project on Farcaster

### Escalation Path

**Level 1 - Self-Service**:
- Check this FAQ
- Review documentation
- Check transaction on BaseScan

**Level 2 - Community**:
- Ask in Farcaster channel
- Check community discussions
- Review similar issues

**Level 3 - Technical Support**:
- Report bugs via GitHub (if applicable)
- Contact project maintainers
- Provide transaction hashes and details

---

*This document should be updated as new issues arise. Last updated: [Current Date]*

