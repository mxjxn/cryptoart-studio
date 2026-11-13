import { pgTable, integer, text, timestamp, jsonb, index, bigint, primaryKey, unique, numeric } from 'drizzle-orm/pg-core';

/**
 * NOTE: This package reuses the existing `indexed_contracts` table from @cryptoart/db
 * for checkpoint tracking. That table is defined in packages/db/src/schema.ts and
 * is shared with the collection-indexer package.
 * 
 * Marketplace contracts use contract_type = 'marketplace'
 * Factory contracts use contract_type = 'factory'
 */

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
 * Primary key: (chain_id, listing_id, marketplace)
 */
export const listings = pgTable(
  'chain_indexer_listings',
  {
    chainId: integer('chain_id').notNull(),
    listingId: numeric('listing_id', { precision: 78, scale: 0 }).notNull(),
    marketplace: text('marketplace').notNull(), // lowercase hex address
    seller: text('seller').notNull(), // lowercase hex address
    
    // Token details
    tokenAddress: text('token_address').notNull(),
    tokenId: numeric('token_id', { precision: 78, scale: 0 }),
    tokenSpec: integer('token_spec').notNull(), // 0=NONE, 1=ERC721, 2=ERC1155
    lazy: integer('lazy').notNull().default(0), // 0=false, 1=true (boolean as int)
    
    // Listing details
    listingType: integer('listing_type').notNull(), // 1=AUCTION, 2=FIXED_PRICE, etc.
    initialAmount: numeric('initial_amount', { precision: 78, scale: 0 }).notNull(),
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
    deliverFixed: numeric('deliver_fixed', { precision: 78, scale: 0 }).notNull(),
    
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
    pk: primaryKey({ columns: [table.chainId, table.listingId, table.marketplace] }),
    sellerIdx: index('chain_indexer_listings_seller_idx').on(table.seller),
    statusIdx: index('chain_indexer_listings_status_idx').on(table.status),
    tokenIdx: index('chain_indexer_listings_token_idx').on(table.chainId, table.tokenAddress, table.tokenId),
    createdAtIdx: index('chain_indexer_listings_created_at_idx').on(table.createdAt),
    endTimeIdx: index('chain_indexer_listings_end_time_idx').on(table.endTime),
  })
);

/**
 * Bids - all bids on listings
 * Immutable once created
 * Primary key: (chain_id, transaction_hash, log_index)
 */
export const bids = pgTable(
  'chain_indexer_bids',
  {
    chainId: integer('chain_id').notNull(),
    listingId: numeric('listing_id', { precision: 78, scale: 0 }).notNull(),
    referrer: text('referrer'),
    bidder: text('bidder').notNull(),
    amount: numeric('amount', { precision: 78, scale: 0 }).notNull(),
    timestamp: bigint('timestamp', { mode: 'bigint' }).notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
    transactionHash: text('transaction_hash').notNull(),
    logIndex: integer('log_index').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] }),
    listingIdx: index('chain_indexer_bids_listing_idx').on(table.chainId, table.listingId),
    bidderIdx: index('chain_indexer_bids_bidder_idx').on(table.bidder),
    timestampIdx: index('chain_indexer_bids_timestamp_idx').on(table.timestamp),
  })
);

/**
 * Purchases - all purchases on listings
 * Immutable once created
 * Primary key: (chain_id, transaction_hash, log_index)
 */
export const purchases = pgTable(
  'chain_indexer_purchases',
  {
    chainId: integer('chain_id').notNull(),
    listingId: numeric('listing_id', { precision: 78, scale: 0 }).notNull(),
    referrer: text('referrer'),
    buyer: text('buyer').notNull(),
    count: integer('count').notNull(),
    amount: numeric('amount', { precision: 78, scale: 0 }).notNull(),
    timestamp: bigint('timestamp', { mode: 'bigint' }).notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
    transactionHash: text('transaction_hash').notNull(),
    logIndex: integer('log_index').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] }),
    listingIdx: index('chain_indexer_purchases_listing_idx').on(table.chainId, table.listingId),
    buyerIdx: index('chain_indexer_purchases_buyer_idx').on(table.buyer),
    timestampIdx: index('chain_indexer_purchases_timestamp_idx').on(table.timestamp),
  })
);

/**
 * Offers - all offers on listings
 * Mutable - status changes on rescind/accept
 * Primary key: (chain_id, transaction_hash, log_index)
 */
export const offers = pgTable(
  'chain_indexer_offers',
  {
    chainId: integer('chain_id').notNull(),
    listingId: numeric('listing_id', { precision: 78, scale: 0 }).notNull(),
    referrer: text('referrer'),
    offerer: text('offerer').notNull(),
    amount: numeric('amount', { precision: 78, scale: 0 }).notNull(),
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
    listingIdx: index('chain_indexer_offers_listing_idx').on(table.chainId, table.listingId),
    offererIdx: index('chain_indexer_offers_offerer_idx').on(table.offerer),
    statusIdx: index('chain_indexer_offers_status_idx').on(table.status),
    timestampIdx: index('chain_indexer_offers_timestamp_idx').on(table.timestamp),
  })
);

/**
 * Escrows - settlement escrow events
 * Immutable once created
 * Primary key: (chain_id, transaction_hash, log_index)
 */
export const escrows = pgTable(
  'chain_indexer_escrows',
  {
    chainId: integer('chain_id').notNull(),
    receiver: text('receiver').notNull(),
    erc20: text('erc20').notNull(), // payment token address
    amount: numeric('amount', { precision: 78, scale: 0 }).notNull(),
    timestamp: bigint('timestamp', { mode: 'bigint' }).notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
    transactionHash: text('transaction_hash').notNull(),
    logIndex: integer('log_index').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] }),
    receiverIdx: index('chain_indexer_escrows_receiver_idx').on(table.receiver),
    timestampIdx: index('chain_indexer_escrows_timestamp_idx').on(table.timestamp),
  })
);

// Type exports for use in application code
export type ChainEvent = typeof chainEvents.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type Bid = typeof bids.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type Escrow = typeof escrows.$inferSelect;
