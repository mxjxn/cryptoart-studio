import { pgTable, integer, text, timestamp, jsonb, index, bigint, primaryKey, unique } from 'drizzle-orm/pg-core';

/**
 * Indexer checkpoints - track indexing progress per contract/chain
 * Primary key: (chain_id, contract)
 */
export const indexerCheckpoints = pgTable(
  'indexer_checkpoints',
  {
    chainId: integer('chain_id').notNull(),
    contract: text('contract').notNull(), // lowercase hex address
    lastBlock: bigint('last_block', { mode: 'bigint' }).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.contract] }),
    updatedAtIdx: index('indexer_checkpoints_updated_at_idx').on(table.updatedAt),
  })
);

/**
 * Generic chain events - raw event storage
 * All indexed events stored in a generic format for replay and debugging
 * Unique constraint: (chain_id, transaction_hash, log_index)
 */
export const chainEvents = pgTable(
  'chain_events',
  {
    chainId: integer('chain_id').notNull(),
    contract: text('contract').notNull(), // lowercase hex address
    eventName: text('event_name').notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
    blockHash: text('block_hash').notNull(),
    transactionHash: text('transaction_hash').notNull(),
    logIndex: integer('log_index').notNull(),
    args: jsonb('args').notNull(), // Event arguments as JSON
    indexedAt: timestamp('indexed_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] }),
    blockNumberIdx: index('chain_events_block_number_idx').on(table.chainId, table.blockNumber),
    contractIdx: index('chain_events_contract_idx').on(table.chainId, table.contract),
    eventNameIdx: index('chain_events_event_name_idx').on(table.eventName),
    indexedAtIdx: index('chain_events_indexed_at_idx').on(table.indexedAt),
  })
);

/**
 * Listings - domain model for marketplace listings
 * Derived from CreateListing, CreateListingTokenDetails, CreateListingFees events
 * Primary key: (chain_id, listing_id)
 */
export const listings = pgTable(
  'listings',
  {
    chainId: integer('chain_id').notNull(),
    listingId: bigint('listing_id', { mode: 'bigint' }).notNull(),
    marketplace: text('marketplace').notNull(), // lowercase hex address
    seller: text('seller').notNull(), // lowercase hex address
    
    // Token details
    tokenAddress: text('token_address').notNull(),
    tokenId: bigint('token_id', { mode: 'bigint' }),
    tokenSpec: integer('token_spec').notNull(), // 0=NONE, 1=ERC721, 2=ERC1155
    lazy: integer('lazy').notNull().default(0), // 0=false, 1=true (boolean as int)
    
    // Listing details
    listingType: integer('listing_type').notNull(), // 1=AUCTION, 2=FIXED_PRICE, etc.
    initialAmount: bigint('initial_amount', { mode: 'bigint' }).notNull(),
    totalAvailable: integer('total_available').notNull(),
    totalPerSale: integer('total_per_sale').notNull(),
    totalSold: integer('total_sold').notNull().default(0),
    
    // Timing
    startTime: bigint('start_time', { mode: 'bigint' }).notNull(),
    endTime: bigint('end_time', { mode: 'bigint' }).notNull(),
    
    // Auction settings
    extensionInterval: integer('extension_interval').notNull(),
    minIncrementBPS: integer('min_increment_bps').notNull(),
    
    // Payment
    erc20: text('erc20'), // payment token address (null for ETH)
    identityVerifier: text('identity_verifier'),
    
    // Fees
    marketplaceBPS: integer('marketplace_bps').notNull(),
    referrerBPS: integer('referrer_bps').notNull(),
    deliverBPS: integer('deliver_bps').notNull(),
    deliverFixed: bigint('deliver_fixed', { mode: 'bigint' }).notNull(),
    
    // Status
    status: text('status').notNull().default('ACTIVE'), // ACTIVE, CANCELLED, FINALIZED
    hasBid: integer('has_bid').notNull().default(0), // 0=false, 1=true
    finalized: integer('finalized').notNull().default(0), // 0=false, 1=true
    
    // Timestamps
    createdAt: timestamp('created_at').notNull(),
    createdAtBlock: bigint('created_at_block', { mode: 'bigint' }).notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    updatedAtBlock: bigint('updated_at_block', { mode: 'bigint' }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.listingId] }),
    sellerIdx: index('listings_seller_idx').on(table.seller),
    statusIdx: index('listings_status_idx').on(table.status),
    tokenIdx: index('listings_token_idx').on(table.chainId, table.tokenAddress, table.tokenId),
    createdAtIdx: index('listings_created_at_idx').on(table.createdAt),
    endTimeIdx: index('listings_end_time_idx').on(table.endTime),
  })
);

/**
 * Bids - all bids on listings
 * Immutable once created
 * Primary key: (chain_id, transaction_hash, log_index)
 */
export const bids = pgTable(
  'bids',
  {
    chainId: integer('chain_id').notNull(),
    listingId: bigint('listing_id', { mode: 'bigint' }).notNull(),
    referrer: text('referrer'),
    bidder: text('bidder').notNull(),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    timestamp: bigint('timestamp', { mode: 'bigint' }).notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
    transactionHash: text('transaction_hash').notNull(),
    logIndex: integer('log_index').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] }),
    listingIdx: index('bids_listing_idx').on(table.chainId, table.listingId),
    bidderIdx: index('bids_bidder_idx').on(table.bidder),
    timestampIdx: index('bids_timestamp_idx').on(table.timestamp),
  })
);

/**
 * Purchases - all purchases on listings
 * Immutable once created
 * Primary key: (chain_id, transaction_hash, log_index)
 */
export const purchases = pgTable(
  'purchases',
  {
    chainId: integer('chain_id').notNull(),
    listingId: bigint('listing_id', { mode: 'bigint' }).notNull(),
    referrer: text('referrer'),
    buyer: text('buyer').notNull(),
    count: integer('count').notNull(),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    timestamp: bigint('timestamp', { mode: 'bigint' }).notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
    transactionHash: text('transaction_hash').notNull(),
    logIndex: integer('log_index').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] }),
    listingIdx: index('purchases_listing_idx').on(table.chainId, table.listingId),
    buyerIdx: index('purchases_buyer_idx').on(table.buyer),
    timestampIdx: index('purchases_timestamp_idx').on(table.timestamp),
  })
);

/**
 * Offers - all offers on listings
 * Mutable - status changes on rescind/accept
 * Primary key: (chain_id, transaction_hash, log_index)
 */
export const offers = pgTable(
  'offers',
  {
    chainId: integer('chain_id').notNull(),
    listingId: bigint('listing_id', { mode: 'bigint' }).notNull(),
    referrer: text('referrer'),
    offerer: text('offerer').notNull(),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    status: text('status').notNull().default('PENDING'), // PENDING, ACCEPTED, RESCINDED
    timestamp: bigint('timestamp', { mode: 'bigint' }).notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
    transactionHash: text('transaction_hash').notNull(),
    logIndex: integer('log_index').notNull(),
    acceptedAt: bigint('accepted_at', { mode: 'bigint' }),
    rescindedAt: bigint('rescinded_at', { mode: 'bigint' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] }),
    listingIdx: index('offers_listing_idx').on(table.chainId, table.listingId),
    offererIdx: index('offers_offerer_idx').on(table.offerer),
    statusIdx: index('offers_status_idx').on(table.status),
    timestampIdx: index('offers_timestamp_idx').on(table.timestamp),
  })
);

/**
 * Escrows - settlement escrow events
 * Immutable once created
 * Primary key: (chain_id, transaction_hash, log_index)
 */
export const escrows = pgTable(
  'escrows',
  {
    chainId: integer('chain_id').notNull(),
    receiver: text('receiver').notNull(),
    erc20: text('erc20').notNull(), // payment token address
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    timestamp: bigint('timestamp', { mode: 'bigint' }).notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
    transactionHash: text('transaction_hash').notNull(),
    logIndex: integer('log_index').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] }),
    receiverIdx: index('escrows_receiver_idx').on(table.receiver),
    timestampIdx: index('escrows_timestamp_idx').on(table.timestamp),
  })
);

// Type exports for use in application code
export type IndexerCheckpoint = typeof indexerCheckpoints.$inferSelect;
export type ChainEvent = typeof chainEvents.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type Bid = typeof bids.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type Escrow = typeof escrows.$inferSelect;
