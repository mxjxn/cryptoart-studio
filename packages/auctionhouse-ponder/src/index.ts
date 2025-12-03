import { ponder } from "ponder:registry";
import { listing, purchase, bid, offer, escrow } from "ponder:schema";

// Marketplace contract address
const MARKETPLACE_ADDRESS = "0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9".toLowerCase();

// Zero address constant
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Handle CreateListing event from MarketplaceLib
ponder.on("MarketplaceCore:CreateListing", async ({ event, context }) => {
  const listingIdStr = event.args.listingId.toString();

  await context.db
    .insert(listing)
    .values({
      id: listingIdStr,
      listingId: BigInt(event.args.listingId),
      marketplace: MARKETPLACE_ADDRESS,
      seller: event.transaction.from.toLowerCase(),
      // Token details - will be filled by CreateListingTokenDetails
      tokenAddress: ZERO_ADDRESS,
      tokenSpec: 0,
      lazy: false,
      // Listing details
      listingType: event.args.listingType,
      initialAmount: event.args.initialAmount,
      totalAvailable: event.args.totalAvailable,
      totalPerSale: event.args.totalPerSale,
      totalSold: 0,
      // Timing
      startTime: BigInt(event.args.startTime),
      endTime: BigInt(event.args.endTime),
      // Auction settings
      extensionInterval: event.args.extensionInterval,
      minIncrementBPS: event.args.minIncrementBPS,
      // Payment
      erc20: event.args.erc20.toLowerCase(),
      identityVerifier: event.args.identityVerifier.toLowerCase(),
      // Fees
      marketplaceBPS: event.args.marketplaceBPS,
      referrerBPS: event.args.referrerBPS,
      deliverBPS: 0,
      deliverFixed: 0n,
      // Status
      status: "ACTIVE",
      hasBid: false,
      finalized: false,
      // Timestamps
      createdAt: event.block.timestamp,
      createdAtBlock: event.block.number,
      updatedAt: event.block.timestamp,
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({
      listingType: event.args.listingType,
      initialAmount: event.args.initialAmount,
      totalAvailable: event.args.totalAvailable,
      totalPerSale: event.args.totalPerSale,
      startTime: BigInt(event.args.startTime),
      endTime: BigInt(event.args.endTime),
      extensionInterval: event.args.extensionInterval,
      minIncrementBPS: event.args.minIncrementBPS,
      erc20: event.args.erc20.toLowerCase(),
      identityVerifier: event.args.identityVerifier.toLowerCase(),
      marketplaceBPS: event.args.marketplaceBPS,
      referrerBPS: event.args.referrerBPS,
      updatedAt: event.block.timestamp,
      updatedAtBlock: event.block.number,
    });
});

// Handle CreateListingTokenDetails event from MarketplaceLib
ponder.on("MarketplaceCore:CreateListingTokenDetails", async ({ event, context }) => {
  const listingIdStr = event.args.listingId.toString();

  await context.db
    .insert(listing)
    .values({
      id: listingIdStr,
      listingId: BigInt(event.args.listingId),
      marketplace: MARKETPLACE_ADDRESS,
      seller: ZERO_ADDRESS,
      tokenAddress: event.args.address_.toLowerCase(),
      tokenId: event.args.id,
      tokenSpec: event.args.spec,
      lazy: event.args.lazy,
      listingType: 0,
      initialAmount: 0n,
      totalAvailable: 0,
      totalPerSale: 0,
      totalSold: 0,
      startTime: 0n,
      endTime: 0n,
      extensionInterval: 0,
      minIncrementBPS: 0,
      marketplaceBPS: 0,
      referrerBPS: 0,
      deliverBPS: 0,
      deliverFixed: 0n,
      status: "ACTIVE",
      hasBid: false,
      finalized: false,
      createdAt: event.block.timestamp,
      createdAtBlock: event.block.number,
      updatedAt: event.block.timestamp,
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({
      tokenAddress: event.args.address_.toLowerCase(),
      tokenId: event.args.id,
      tokenSpec: event.args.spec,
      lazy: event.args.lazy,
      updatedAt: event.block.timestamp,
      updatedAtBlock: event.block.number,
    });
});

// Handle CreateListingFees event from MarketplaceLib
ponder.on("MarketplaceCore:CreateListingFees", async ({ event, context }) => {
  const listingIdStr = event.args.listingId.toString();

  await context.db
    .insert(listing)
    .values({
      id: listingIdStr,
      listingId: BigInt(event.args.listingId),
      marketplace: MARKETPLACE_ADDRESS,
      seller: ZERO_ADDRESS,
      tokenAddress: ZERO_ADDRESS,
      tokenSpec: 0,
      lazy: false,
      listingType: 0,
      initialAmount: 0n,
      totalAvailable: 0,
      totalPerSale: 0,
      totalSold: 0,
      startTime: 0n,
      endTime: 0n,
      extensionInterval: 0,
      minIncrementBPS: 0,
      marketplaceBPS: 0,
      referrerBPS: 0,
      deliverBPS: event.args.deliverBPS,
      deliverFixed: event.args.deliverFixed,
      status: "ACTIVE",
      hasBid: false,
      finalized: false,
      createdAt: event.block.timestamp,
      createdAtBlock: event.block.number,
      updatedAt: event.block.timestamp,
      updatedAtBlock: event.block.number,
    })
    .onConflictDoUpdate({
      deliverBPS: event.args.deliverBPS,
      deliverFixed: event.args.deliverFixed,
      updatedAt: event.block.timestamp,
      updatedAtBlock: event.block.number,
    });
});

// Handle PurchaseEvent from MarketplaceLib
ponder.on("MarketplaceCore:PurchaseEvent", async ({ event, context }) => {
  const listingIdStr = event.args.listingId.toString();
  const purchaseId = `${event.transaction.hash}-${event.log.logIndex}`;

  // Get current listing to update totalSold
  const currentListing = await context.db.find(listing, { id: listingIdStr });

  if (currentListing) {
    // Update listing total sold
    // Note: event.args.count is the purchase count, but the contract actually sells count * totalPerSale copies
    const newTotalSold = currentListing.totalSold + event.args.count * currentListing.totalPerSale;

    await context.db.update(listing, { id: listingIdStr }).set({
      totalSold: newTotalSold,
      updatedAt: event.block.timestamp,
      updatedAtBlock: event.block.number,
    });
  }

  // Create Purchase entity
  await context.db.insert(purchase).values({
    id: purchaseId,
    listingId: listingIdStr,
    listingBigIntId: BigInt(event.args.listingId),
    referrer: event.args.referrer.toLowerCase(),
    buyer: event.args.buyer.toLowerCase(),
    count: event.args.count,
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

// Handle BidEvent from MarketplaceLib
ponder.on("MarketplaceCore:BidEvent", async ({ event, context }) => {
  const listingIdStr = event.args.listingId.toString();
  const bidId = `${event.transaction.hash}-${event.log.logIndex}`;

  // Update listing hasBid flag
  await context.db.update(listing, { id: listingIdStr }).set({
    hasBid: true,
    updatedAt: event.block.timestamp,
    updatedAtBlock: event.block.number,
  });

  // Create Bid entity
  await context.db.insert(bid).values({
    id: bidId,
    listingId: listingIdStr,
    listingBigIntId: BigInt(event.args.listingId),
    referrer: event.args.referrer.toLowerCase(),
    bidder: event.args.bidder.toLowerCase(),
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

// Handle OfferEvent from MarketplaceLib
ponder.on("MarketplaceCore:OfferEvent", async ({ event, context }) => {
  const listingIdStr = event.args.listingId.toString();
  const offerId = `${event.transaction.hash}-${event.log.logIndex}`;

  // Create Offer entity
  await context.db.insert(offer).values({
    id: offerId,
    listingId: listingIdStr,
    listingBigIntId: BigInt(event.args.listingId),
    referrer: event.args.referrer.toLowerCase(),
    offerer: event.args.offerrer.toLowerCase(), // Note: ABI has typo "offerrer" instead of "offerer"
    amount: event.args.amount,
    status: "PENDING",
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

// Handle RescindOfferEvent from MarketplaceLib
ponder.on("MarketplaceCore:RescindOfferEvent", async ({ event, context }) => {
  const listingIdStr = event.args.listingId.toString();

  // Update listing timestamp
  await context.db.update(listing, { id: listingIdStr }).set({
    updatedAt: event.block.timestamp,
    updatedAtBlock: event.block.number,
  });

  // Note: In a full implementation, you'd query offers by listingId and offerer
  // to update the specific offer status. For now, we just update the listing.
});

// Handle AcceptOfferEvent from MarketplaceLib
ponder.on("MarketplaceCore:AcceptOfferEvent", async ({ event, context }) => {
  const listingIdStr = event.args.listingId.toString();

  // Update listing timestamp
  await context.db.update(listing, { id: listingIdStr }).set({
    updatedAt: event.block.timestamp,
    updatedAtBlock: event.block.number,
  });

  // Note: In a full implementation, you'd query offers by listingId and offerer
  // to update the specific offer status. For now, we just update the listing.
});

// Handle ModifyListing from MarketplaceLib
ponder.on("MarketplaceCore:ModifyListing", async ({ event, context }) => {
  const listingIdStr = event.args.listingId.toString();

  await context.db.update(listing, { id: listingIdStr }).set({
    initialAmount: event.args.initialAmount,
    startTime: BigInt(event.args.startTime),
    endTime: BigInt(event.args.endTime),
    updatedAt: event.block.timestamp,
    updatedAtBlock: event.block.number,
  });
});

// Handle CancelListing from MarketplaceLib
ponder.on("MarketplaceCore:CancelListing", async ({ event, context }) => {
  const listingIdStr = event.args.listingId.toString();

  await context.db.update(listing, { id: listingIdStr }).set({
    status: "CANCELLED",
    updatedAt: event.block.timestamp,
    updatedAtBlock: event.block.number,
  });
});

// Handle FinalizeListing from MarketplaceLib
ponder.on("MarketplaceCore:FinalizeListing", async ({ event, context }) => {
  const listingIdStr = event.args.listingId.toString();

  await context.db.update(listing, { id: listingIdStr }).set({
    status: "FINALIZED",
    finalized: true,
    updatedAt: event.block.timestamp,
    updatedAtBlock: event.block.number,
  });
});

// Handle Escrow event from SettlementLib
ponder.on("SettlementLib:Escrow", async ({ event, context }) => {
  const escrowId = `${event.transaction.hash}-${event.log.logIndex}`;

  await context.db.insert(escrow).values({
    id: escrowId,
    receiver: event.args.receiver.toLowerCase(),
    erc20: event.args.erc20.toLowerCase(),
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});
