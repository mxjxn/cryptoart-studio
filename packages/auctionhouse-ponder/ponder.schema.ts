import { index, onchainTable, relations } from "ponder";

// Listing entity
export const listing = onchainTable(
  "listing",
  (t) => ({
    id: t.text().primaryKey(), // listingId
    listingId: t.bigint().notNull(),
    marketplace: t.text().notNull(), // marketplace contract address

    seller: t.text().notNull(),

    // Token details
    tokenAddress: t.text().notNull(),
    tokenId: t.bigint(),
    tokenSpec: t.integer().notNull(), // 0 = NONE, 1 = ERC721, 2 = ERC1155
    lazy: t.boolean().notNull(),

    // Listing details
    listingType: t.integer().notNull(), // 0 = INVALID, 1 = INDIVIDUAL_AUCTION, 2 = FIXED_PRICE, 3 = DYNAMIC_PRICE, 4 = OFFERS_ONLY
    initialAmount: t.bigint().notNull(),
    totalAvailable: t.integer().notNull(),
    totalPerSale: t.integer().notNull(),
    totalSold: t.integer().notNull(),

    // Timing
    startTime: t.bigint().notNull(),
    endTime: t.bigint().notNull(),

    // Auction settings
    extensionInterval: t.integer().notNull(),
    minIncrementBPS: t.integer().notNull(),

    // Payment
    erc20: t.text(), // payment token address (zero address for ETH)
    identityVerifier: t.text(),

    // Fees
    marketplaceBPS: t.integer().notNull(),
    referrerBPS: t.integer().notNull(),
    deliverBPS: t.integer().notNull(),
    deliverFixed: t.bigint().notNull(),

    // Status
    status: t.text().notNull(), // ACTIVE, CANCELLED, FINALIZED
    hasBid: t.boolean().notNull(),
    finalized: t.boolean().notNull(),

    // Timestamps
    createdAt: t.bigint().notNull(),
    createdAtBlock: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
    updatedAtBlock: t.bigint().notNull(),
  }),
  (table) => ({
    sellerIdx: index().on(table.seller),
    statusIdx: index().on(table.status),
    listingTypeIdx: index().on(table.listingType),
  })
);

export const listingRelations = relations(listing, ({ many }) => ({
  purchases: many(purchase),
  bids: many(bid),
  offers: many(offer),
}));

// Purchase entity
export const purchase = onchainTable(
  "purchase",
  (t) => ({
    id: t.text().primaryKey(), // transaction hash + log index
    listingId: t.text().notNull(), // foreign key to listing
    listingBigIntId: t.bigint().notNull(),
    referrer: t.text(),
    buyer: t.text().notNull(),
    count: t.integer().notNull(),
    amount: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.text().notNull(),
  }),
  (table) => ({
    listingIdIdx: index().on(table.listingId),
    buyerIdx: index().on(table.buyer),
  })
);

export const purchaseRelations = relations(purchase, ({ one }) => ({
  listing: one(listing, {
    fields: [purchase.listingId],
    references: [listing.id],
  }),
}));

// Bid entity
export const bid = onchainTable(
  "bid",
  (t) => ({
    id: t.text().primaryKey(), // transaction hash + log index
    listingId: t.text().notNull(), // foreign key to listing
    listingBigIntId: t.bigint().notNull(),
    referrer: t.text(),
    bidder: t.text().notNull(),
    amount: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.text().notNull(),
  }),
  (table) => ({
    listingIdIdx: index().on(table.listingId),
    bidderIdx: index().on(table.bidder),
  })
);

export const bidRelations = relations(bid, ({ one }) => ({
  listing: one(listing, {
    fields: [bid.listingId],
    references: [listing.id],
  }),
}));

// Offer entity
export const offer = onchainTable(
  "offer",
  (t) => ({
    id: t.text().primaryKey(), // transaction hash + log index
    listingId: t.text().notNull(), // foreign key to listing
    listingBigIntId: t.bigint().notNull(),
    referrer: t.text(),
    offerer: t.text().notNull(),
    amount: t.bigint().notNull(),
    status: t.text().notNull(), // PENDING, ACCEPTED, RESCINDED
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.text().notNull(),
    acceptedAt: t.bigint(),
    rescindedAt: t.bigint(),
  }),
  (table) => ({
    listingIdIdx: index().on(table.listingId),
    offererIdx: index().on(table.offerer),
    statusIdx: index().on(table.status),
  })
);

export const offerRelations = relations(offer, ({ one }) => ({
  listing: one(listing, {
    fields: [offer.listingId],
    references: [listing.id],
  }),
}));

// Escrow entity
export const escrow = onchainTable(
  "escrow",
  (t) => ({
    id: t.text().primaryKey(), // transaction hash + log index
    receiver: t.text().notNull(),
    erc20: t.text().notNull(), // payment token address
    amount: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.text().notNull(),
  }),
  (table) => ({
    receiverIdx: index().on(table.receiver),
  })
);
