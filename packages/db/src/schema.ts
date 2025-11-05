import { pgTable, serial, integer, text, timestamp, jsonb, index, bigint, boolean } from 'drizzle-orm/pg-core';

// Subscriptions cache table
export const subscriptionsCache = pgTable('subscriptions_cache', {
  id: serial('id').primaryKey(),
  fid: integer('fid').notNull(),
  contractAddress: text('contract_address').notNull(),
  metadata: jsonb('metadata').notNull(),
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
}, (table) => ({
  fidIdx: index('subscriptions_cache_fid_idx').on(table.fid),
  contractAddressIdx: index('subscriptions_cache_contract_address_idx').on(table.contractAddress),
  fidContractIdx: index('subscriptions_cache_fid_contract_idx').on(table.fid, table.contractAddress),
}));

// Subscribers cache table
export const subscribersCache = pgTable('subscribers_cache', {
  id: serial('id').primaryKey(),
  fid: integer('fid').notNull(),
  contractAddress: text('contract_address').notNull(),
  subscriberData: jsonb('subscriber_data').notNull(),
  subscriberCount: integer('subscriber_count').notNull(),
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => ({
  fidIdx: index('subscribers_cache_fid_idx').on(table.fid),
  contractAddressIdx: index('subscribers_cache_contract_address_idx').on(table.contractAddress),
  fidContractIdx: index('subscribers_cache_fid_contract_idx').on(table.fid, table.contractAddress),
  expiresAtIdx: index('subscribers_cache_expires_at_idx').on(table.expiresAt),
}));

// Type definitions for the cached data
export interface SubscriptionCacheData {
  object: string;
  provider_name: string;
  contract_address: string;
  chain: number;
  metadata: {
    title: string;
    symbol: string;
    art_url: string;
  };
  owner_address: string;
  price: {
    period_duration_seconds: number;
    tokens_per_period: string;
    initial_mint_price: string;
  };
  protocol_version: number;
  token: {
    symbol: string;
    address: string | null;
    decimals: number;
    erc20: boolean;
  };
  tiers?: Array<{
    id: string;
    price: {
      period_duration_seconds: number;
      tokens_per_period: string;
      initial_mint_price: string;
    };
  }>;
}

export interface SubscriberCacheData {
  user: {
    fid: number;
    username: string;
    display_name: string;
    verified_addresses?: {
      primary?: {
        eth_address: string;
      };
    };
  };
  subscribed_to: Array<{
    contract_address: string;
    subscribed_at: string;
    expires_at: string;
  }>;
}

// Airdrop lists - for manually curated recipient lists
export const airdropLists = pgTable('airdrop_lists', {
  id: serial('id').primaryKey(),
  creatorFid: integer('creator_fid').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  creatorFidIdx: index('airdrop_lists_creator_fid_idx').on(table.creatorFid),
}));

// List recipients - many-to-many
export const listRecipients = pgTable('list_recipients', {
  id: serial('id').primaryKey(),
  listId: integer('list_id').references(() => airdropLists.id),
  fid: integer('fid'),
  walletAddress: text('wallet_address'),
  addedAt: timestamp('added_at').defaultNow(),
}, (table) => ({
  listIdIdx: index('list_recipients_list_id_idx').on(table.listId),
  fidIdx: index('list_recipients_fid_idx').on(table.fid),
  walletAddressIdx: index('list_recipients_wallet_address_idx').on(table.walletAddress),
}));

// Airdrop history tracking
export const airdropHistory = pgTable('airdrop_history', {
  id: serial('id').primaryKey(),
  creatorFid: integer('creator_fid').notNull(),
  tokenAddress: text('token_address').notNull(),
  chain: integer('chain').notNull(),
  recipientCount: integer('recipient_count').notNull(),
  totalAmount: text('total_amount').notNull(),
  txHash: text('tx_hash'),
  status: text('status').notNull(), // 'pending', 'success', 'failed'
  createdAt: timestamp('created_at').defaultNow(),
  metadata: jsonb('metadata'),
}, (table) => ({
  creatorFidIdx: index('airdrop_history_creator_fid_idx').on(table.creatorFid),
  tokenAddressIdx: index('airdrop_history_token_address_idx').on(table.tokenAddress),
  statusIdx: index('airdrop_history_status_idx').on(table.status),
}));

// NFT Collections deployed by creators
export const nftCollections = pgTable('nft_collections', {
  id: serial('id').primaryKey(),
  creatorFid: integer('creator_fid').notNull(),
  contractAddress: text('contract_address').notNull().unique(),
  contractType: text('contract_type').notNull(), // 'ERC721' or 'ERC1155'
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  chain: integer('chain').notNull(), // 8453 for Base
  deployTxHash: text('deploy_tx_hash'),
  deployedAt: timestamp('deployed_at').defaultNow(),
  metadata: jsonb('metadata'), // baseURI, royalties, etc.
  status: text('status').notNull(), // 'deploying', 'active', 'failed'
}, (table) => ({
  creatorFidIdx: index('nft_collections_creator_fid_idx').on(table.creatorFid),
  contractAddressIdx: index('nft_collections_contract_address_idx').on(table.contractAddress),
  statusIdx: index('nft_collections_status_idx').on(table.status),
}));

// Track mints from deployed collections
export const collectionMints = pgTable('collection_mints', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id').references(() => nftCollections.id),
  tokenId: text('token_id').notNull(),
  recipientAddress: text('recipient_address').notNull(),
  recipientFid: integer('recipient_fid'),
  txHash: text('tx_hash'),
  mintedAt: timestamp('minted_at').defaultNow(),
  metadata: jsonb('metadata'), // tokenURI, image, etc.
}, (table) => ({
  collectionIdIdx: index('collection_mints_collection_id_idx').on(table.collectionId),
  recipientAddressIdx: index('collection_mints_recipient_address_idx').on(table.recipientAddress),
  recipientFidIdx: index('collection_mints_recipient_fid_idx').on(table.recipientFid),
}));

// Clanker tokens deployed by creators
export const clankerTokens = pgTable('clanker_tokens', {
  id: serial('id').primaryKey(),
  creatorFid: integer('creator_fid').notNull(),
  tokenAddress: text('token_address').notNull().unique(),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  chain: integer('chain').notNull(), // 8453 for Base
  deployTxHash: text('deploy_tx_hash'),
  deployedAt: timestamp('deployed_at').defaultNow(),
  metadata: jsonb('metadata'), // image, description, etc.
  status: text('status').notNull(), // 'deploying', 'active', 'failed'
}, (table) => ({
  creatorFidIdx: index('clanker_tokens_creator_fid_idx').on(table.creatorFid),
  tokenAddressIdx: index('clanker_tokens_token_address_idx').on(table.tokenAddress),
  statusIdx: index('clanker_tokens_status_idx').on(table.status),
}));

// Auction listings table
export const auctionListings = pgTable('auction_listings', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id').notNull().unique(), // Contract listing ID
  seller: text('seller').notNull(),
  finalized: boolean('finalized').default(false).notNull(),
  totalSold: integer('total_sold').default(0).notNull(),
  marketplaceBPS: integer('marketplace_bps').notNull(),
  referrerBPS: integer('referrer_bps').notNull(),
  listingType: integer('listing_type').notNull(), // 1 = INDIVIDUAL_AUCTION
  // Listing details
  initialAmount: text('initial_amount').notNull(), // Reserve price for auctions
  totalAvailable: integer('total_available').notNull(),
  totalPerSale: integer('total_per_sale').notNull(),
  extensionInterval: integer('extension_interval'),
  minIncrementBPS: integer('min_increment_bps'),
  erc20: text('erc20'), // Payment token address (null for ETH)
  identityVerifier: text('identity_verifier'),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time').notNull(),
  // Token details
  tokenId: text('token_id').notNull(),
  tokenAddress: text('token_address').notNull(),
  tokenSpec: integer('token_spec').notNull(), // 0 = ERC721, 1 = ERC1155
  lazy: boolean('lazy').default(false).notNull(),
  // Delivery fees
  deliverBPS: integer('deliver_bps').default(0),
  deliverFixed: text('deliver_fixed').default('0'),
  // Current bid (for INDIVIDUAL_AUCTION)
  currentBidAmount: text('current_bid_amount'),
  currentBidder: text('current_bidder'),
  currentBidTimestamp: timestamp('current_bid_timestamp'),
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  blockNumber: integer('block_number'),
  txHash: text('tx_hash'),
  // Additional fields stored as JSON
  receivers: jsonb('receivers'), // Array of ListingReceiver
  metadata: jsonb('metadata'), // NFT metadata (name, image, etc.)
}, (table) => ({
  listingIdIdx: index('auction_listings_listing_id_idx').on(table.listingId),
  sellerIdx: index('auction_listings_seller_idx').on(table.seller),
  listingTypeIdx: index('auction_listings_listing_type_idx').on(table.listingType),
  finalizedIdx: index('auction_listings_finalized_idx').on(table.finalized),
  endTimeIdx: index('auction_listings_end_time_idx').on(table.endTime),
  tokenAddressIdx: index('auction_listings_token_address_idx').on(table.tokenAddress),
  // Composite index for active auctions
  activeAuctionsIdx: index('auction_listings_active_idx').on(table.listingType, table.finalized, table.endTime),
}));

// Bid history table (all bids, not just current)
export const auctionBids = pgTable('auction_bids', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id').notNull(),
  bidder: text('bidder').notNull(),
  amount: text('amount').notNull(),
  referrer: text('referrer'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  blockNumber: integer('block_number'),
  txHash: text('tx_hash').notNull(),
  delivered: boolean('delivered').default(false),
  settled: boolean('settled').default(false),
  refunded: boolean('refunded').default(false),
}, (table) => ({
  listingIdIdx: index('auction_bids_listing_id_idx').on(table.listingId),
  bidderIdx: index('auction_bids_bidder_idx').on(table.bidder),
  timestampIdx: index('auction_bids_timestamp_idx').on(table.timestamp),
  txHashIdx: index('auction_bids_tx_hash_idx').on(table.txHash),
  // Composite index for listing bids
  listingBidsIdx: index('auction_bids_listing_timestamp_idx').on(table.listingId, table.timestamp),
}));
