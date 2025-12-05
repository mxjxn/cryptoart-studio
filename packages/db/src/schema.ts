import { pgTable, integer, text, timestamp, jsonb, index, boolean, serial, bigint, uuid, pgEnum } from 'drizzle-orm/pg-core';

/**
 * User cache table - Cache user information from Neynar, ENS, etc.
 * Supports both artists and collectors
 * Primary key: eth_address (lowercase)
 */
export const userCache = pgTable('user_cache', {
  ethAddress: text('eth_address').primaryKey().notNull(),
  fid: integer('fid'), // Farcaster ID
  username: text('username'), // Farcaster username
  displayName: text('display_name'), // Farcaster display name
  pfpUrl: text('pfp_url'), // Profile picture URL
  verifiedWallets: jsonb('verified_wallets'), // Array of verified wallet addresses
  ensName: text('ens_name'), // ENS name if resolved
  source: text('source').notNull(), // 'neynar' | 'ens' | 'manual' | 'contract-creator'
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // TTL: 30 days
  refreshedAt: timestamp('refreshed_at'), // Manual refresh timestamp
}, (table) => ({
  fidIdx: index('user_cache_fid_idx').on(table.fid),
  usernameIdx: index('user_cache_username_idx').on(table.username),
  expiresAtIdx: index('user_cache_expires_at_idx').on(table.expiresAt),
}));

/**
 * Contract cache table - Cache contract information (name, symbol, creator)
 * Primary key: contract_address (lowercase)
 */
export const contractCache = pgTable('contract_cache', {
  contractAddress: text('contract_address').primaryKey().notNull(),
  name: text('name'), // Contract name from name() or Alchemy
  symbol: text('symbol'), // Contract symbol
  creatorAddress: text('creator_address'), // Contract creator/deployer
  source: text('source').notNull(), // 'onchain' | 'alchemy' | 'manual'
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // TTL: 30 days
  refreshedAt: timestamp('refreshed_at'), // Manual refresh timestamp
}, (table) => ({
  creatorAddressIdx: index('contract_cache_creator_address_idx').on(table.creatorAddress),
  expiresAtIdx: index('contract_cache_expires_at_idx').on(table.expiresAt),
}));

// Type definitions for cached data
export interface UserCacheData {
  ethAddress: string;
  fid?: number | null;
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
  verifiedWallets?: string[] | null;
  ensName?: string | null;
  source: 'neynar' | 'ens' | 'manual' | 'contract-creator';
  cachedAt: Date;
  expiresAt: Date;
  refreshedAt?: Date | null;
}

export interface ContractCacheData {
  contractAddress: string;
  name?: string | null;
  symbol?: string | null;
  creatorAddress?: string | null;
  source: 'onchain' | 'alchemy' | 'manual';
  cachedAt: Date;
  expiresAt: Date;
  refreshedAt?: Date | null;
}

/**
 * Notifications table - Store in-app notifications for users
 */
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userAddress: text('user_address').notNull(), // Recipient ETH address
  fid: integer('fid'), // Farcaster ID if available
  type: text('type').notNull(), // Notification type enum
  listingId: text('listing_id'), // Related listing ID
  title: text('title').notNull(), // Notification title
  message: text('message').notNull(), // Notification message
  metadata: jsonb('metadata'), // Additional structured data
  read: boolean('read').default(false).notNull(), // Read status
  pushed: boolean('pushed').default(false).notNull(), // Whether push notification was sent
  createdAt: timestamp('created_at').defaultNow().notNull(),
  readAt: timestamp('read_at'), // When notification was read
}, (table) => ({
  userAddressIdx: index('notifications_user_address_idx').on(table.userAddress),
  fidIdx: index('notifications_fid_idx').on(table.fid),
  listingIdIdx: index('notifications_listing_id_idx').on(table.listingId),
  readIdx: index('notifications_read_idx').on(table.read),
  createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
}));

/**
 * Notification preferences table - User preferences for notifications
 */
export const notificationPreferences = pgTable('notification_preferences', {
  userAddress: text('user_address').primaryKey().notNull(),
  fid: integer('fid'), // Farcaster ID if available
  pushEnabled: boolean('push_enabled').default(true).notNull(),
  inAppEnabled: boolean('in_app_enabled').default(true).notNull(),
  emailEnabled: boolean('email_enabled').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  fidIdx: index('notification_preferences_fid_idx').on(table.fid),
}));

// Type definitions for notifications
export type NotificationType = 
  | 'LISTING_CREATED'
  | 'NEW_BID'
  | 'AUCTION_WON'
  | 'AUCTION_ENDED_NO_BIDS'
  | 'BUY_NOW_SALE'
  | 'NEW_OFFER'
  | 'BID_PLACED'
  | 'OUTBID'
  | 'ERC1155_PURCHASE'
  | 'ERC721_PURCHASE'
  | 'OFFER_ACCEPTED'
  | 'OFFER_RESCINDED'
  | 'LISTING_CANCELLED'
  | 'LISTING_MODIFIED'
  | 'FOLLOWED_USER_NEW_LISTING'
  | 'FAVORITE_LOW_STOCK'
  | 'FAVORITE_NEW_BID'
  | 'FAVORITE_ENDING_SOON';

export interface NotificationData {
  id: number;
  userAddress: string;
  fid?: number | null;
  type: NotificationType;
  listingId?: string | null;
  title: string;
  message: string;
  metadata?: Record<string, any> | null;
  read: boolean;
  pushed: boolean;
  createdAt: Date;
  readAt?: Date | null;
}

export interface NotificationPreferencesData {
  userAddress: string;
  fid?: number | null;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  updatedAt: Date;
}

/**
 * Notification worker state table - Track last processed block/timestamp
 */
export const notificationWorkerState = pgTable('notification_worker_state', {
  id: serial('id').primaryKey(),
  lastProcessedBlock: bigint('last_processed_block', { mode: 'number' }).notNull(),
  lastProcessedTimestamp: bigint('last_processed_timestamp', { mode: 'number' }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export interface NotificationWorkerStateData {
  id: number;
  lastProcessedBlock: number;
  lastProcessedTimestamp: number;
  updatedAt: Date;
}

/**
 * Image cache table - Cache artwork images as data URLs for OG image generation
 * Primary key: image_url (normalized)
 */
export const imageCache = pgTable('image_cache', {
  imageUrl: text('image_url').primaryKey().notNull(), // Original image URL (normalized)
  dataUrl: text('data_url').notNull(), // Base64 data URL
  contentType: text('content_type').notNull(), // MIME type (e.g., image/png)
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // TTL: 3 days
}, (table) => ({
  expiresAtIdx: index('image_cache_expires_at_idx').on(table.expiresAt),
}));

export interface ImageCacheData {
  imageUrl: string;
  dataUrl: string;
  contentType: string;
  cachedAt: Date;
  expiresAt: Date;
}

/**
 * Follows table - Track user follows
 * followerAddress follows followingAddress
 */
export const follows = pgTable('follows', {
  id: serial('id').primaryKey(),
  followerAddress: text('follower_address').notNull(), // User who is following
  followingAddress: text('following_address').notNull(), // User being followed
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  followerAddressIdx: index('follows_follower_address_idx').on(table.followerAddress),
  followingAddressIdx: index('follows_following_address_idx').on(table.followingAddress),
  uniqueFollowIdx: index('follows_unique_follow_idx').on(table.followerAddress, table.followingAddress),
}));

export interface FollowData {
  id: number;
  followerAddress: string;
  followingAddress: string;
  createdAt: Date;
}

/**
 * Favorites table - Track user favorite listings
 */
export const favorites = pgTable('favorites', {
  id: serial('id').primaryKey(),
  userAddress: text('user_address').notNull(), // User who favorited
  listingId: text('listing_id').notNull(), // Listing ID
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userAddressIdx: index('favorites_user_address_idx').on(table.userAddress),
  listingIdIdx: index('favorites_listing_id_idx').on(table.listingId),
  uniqueFavoriteIdx: index('favorites_unique_favorite_idx').on(table.userAddress, table.listingId),
}));

export interface FavoriteData {
  id: number;
  userAddress: string;
  listingId: string;
  createdAt: Date;
}

// ============================================
// ADMIN: Featured Listings
// ============================================

/**
 * Featured listings table - Store manually or auto-selected featured listings
 */
export const featuredListings = pgTable('featured_listings', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: text('listing_id').notNull().unique(), // On-chain listing ID
  displayOrder: integer('display_order').notNull().default(0), // For manual ordering
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  displayOrderIdx: index('featured_listings_display_order_idx').on(table.displayOrder),
}));

export interface FeaturedListingData {
  id: string;
  listingId: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Featured settings table - Singleton table for featured listings configuration
 */
export const featuredSettings = pgTable('featured_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  autoMode: boolean('auto_mode').notNull().default(false),
  autoCount: integer('auto_count').notNull().default(5), // Number of random listings in auto mode
  lastAutoRefresh: timestamp('last_auto_refresh'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export interface FeaturedSettingsData {
  id: string;
  autoMode: boolean;
  autoCount: number;
  lastAutoRefresh: Date | null;
  updatedAt: Date;
}

// ============================================
// ADMIN: Hidden Users
// ============================================

/**
 * Hidden users table - Store users hidden from algorithmic feeds
 */
export const hiddenUsers = pgTable('hidden_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  userAddress: text('user_address').notNull().unique(), // Wallet address (lowercase)
  hiddenAt: timestamp('hidden_at').defaultNow().notNull(),
  hiddenBy: text('hidden_by').notNull(), // Admin address who hid them
}, (table) => ({
  userAddressIdx: index('hidden_users_user_address_idx').on(table.userAddress),
}));

export interface HiddenUserData {
  id: string;
  userAddress: string;
  hiddenAt: Date;
  hiddenBy: string;
}

// ============================================
// ADMIN: Analytics Snapshots
// ============================================

/**
 * Analytics snapshots table - Store periodic analytics data
 */
export const analyticsSnapshots = pgTable('analytics_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  snapshotDate: timestamp('snapshot_date').notNull(),
  periodType: text('period_type').notNull(), // 'daily', 'weekly', 'monthly', 'yearly'
  
  // Volume metrics (in wei, stored as string for precision)
  totalVolumeWei: text('total_volume_wei').notNull().default('0'),
  auctionVolumeWei: text('auction_volume_wei').notNull().default('0'),
  fixedPriceVolumeWei: text('fixed_price_volume_wei').notNull().default('0'),
  offerVolumeWei: text('offer_volume_wei').notNull().default('0'),
  
  // Fee metrics (in wei)
  platformFeesWei: text('platform_fees_wei').notNull().default('0'),
  referralFeesWei: text('referral_fees_wei').notNull().default('0'),
  
  // Count metrics
  totalSales: integer('total_sales').notNull().default(0),
  auctionSales: integer('auction_sales').notNull().default(0),
  fixedPriceSales: integer('fixed_price_sales').notNull().default(0),
  offerSales: integer('offer_sales').notNull().default(0),
  activeAuctions: integer('active_auctions').notNull().default(0),
  uniqueBidders: integer('unique_bidders').notNull().default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  snapshotDateIdx: index('analytics_snapshots_snapshot_date_idx').on(table.snapshotDate),
  periodTypeIdx: index('analytics_snapshots_period_type_idx').on(table.periodType),
}));

export interface AnalyticsSnapshotData {
  id: string;
  snapshotDate: Date;
  periodType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  totalVolumeWei: string;
  auctionVolumeWei: string;
  fixedPriceVolumeWei: string;
  offerVolumeWei: string;
  platformFeesWei: string;
  referralFeesWei: string;
  totalSales: number;
  auctionSales: number;
  fixedPriceSales: number;
  offerSales: number;
  activeAuctions: number;
  uniqueBidders: number;
  createdAt: Date;
}

// ============================================
// ADMIN: Error Logging
// ============================================

export const errorLogTypeEnum = pgEnum('error_log_type', [
  'transaction_failed',
  'api_error',
  'subgraph_error',
  'contract_error',
  'webhook_error',
  'unknown'
]);

/**
 * Error logs table - Store application errors for admin review
 */
export const errorLogs = pgTable('error_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: errorLogTypeEnum('type').notNull(),
  message: text('message').notNull(),
  stack: text('stack'),
  
  // Context
  userAddress: text('user_address'), // If associated with a user
  listingId: text('listing_id'), // If associated with a listing
  transactionHash: text('transaction_hash'), // If associated with a tx
  endpoint: text('endpoint'), // API endpoint or function name
  
  // Additional data
  metadata: jsonb('metadata'), // Any additional context as JSON
  
  // Status
  resolved: boolean('resolved').notNull().default(false),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  typeIdx: index('error_logs_type_idx').on(table.type),
  resolvedIdx: index('error_logs_resolved_idx').on(table.resolved),
  createdAtIdx: index('error_logs_created_at_idx').on(table.createdAt),
  userAddressIdx: index('error_logs_user_address_idx').on(table.userAddress),
}));

export type ErrorLogType = typeof errorLogTypeEnum.enumValues[number];

export interface ErrorLogData {
  id: string;
  type: ErrorLogType;
  message: string;
  stack?: string | null;
  userAddress?: string | null;
  listingId?: string | null;
  transactionHash?: string | null;
  endpoint?: string | null;
  metadata?: Record<string, unknown> | null;
  resolved: boolean;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
  createdAt: Date;
}

// ============================================
// ADMIN: Global Notification Settings
// ============================================

/**
 * Global notification settings table - Singleton table for platform-wide notification controls
 */
export const globalNotificationSettings = pgTable('global_notification_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Your Listings section
  newBidOnYourAuction: boolean('new_bid_on_your_auction').notNull().default(true),
  auctionEnding24h: boolean('auction_ending_24h').notNull().default(true),
  auctionEnding1h: boolean('auction_ending_1h').notNull().default(true),
  offerReceived: boolean('offer_received').notNull().default(true),
  
  // Your Bids section
  outbid: boolean('outbid').notNull().default(true),
  auctionWon: boolean('auction_won').notNull().default(true),
  
  // Purchases section
  purchaseConfirmation: boolean('purchase_confirmation').notNull().default(true),
  
  // Offers section
  offerAccepted: boolean('offer_accepted').notNull().default(true),
  offerRejected: boolean('offer_rejected').notNull().default(true),
  
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export interface GlobalNotificationSettingsData {
  id: string;
  newBidOnYourAuction: boolean;
  auctionEnding24h: boolean;
  auctionEnding1h: boolean;
  offerReceived: boolean;
  outbid: boolean;
  auctionWon: boolean;
  purchaseConfirmation: boolean;
  offerAccepted: boolean;
  offerRejected: boolean;
  updatedAt: Date;
}

// ============================================
// USER: Notification Preferences (Extended)
// ============================================

/**
 * User notification preferences table - Store per-user notification settings
 */
export const userNotificationPreferences = pgTable('user_notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userAddress: text('user_address').notNull().unique(),
  
  // Your Listings section
  newBidOnYourAuction: boolean('new_bid_on_your_auction').notNull().default(true),
  auctionEnding24h: boolean('auction_ending_24h').notNull().default(true),
  auctionEnding1h: boolean('auction_ending_1h').notNull().default(true),
  offerReceived: boolean('offer_received').notNull().default(true),
  
  // Your Bids section
  outbid: boolean('outbid').notNull().default(true),
  auctionWon: boolean('auction_won').notNull().default(true),
  
  // Purchases section
  purchaseConfirmation: boolean('purchase_confirmation').notNull().default(true),
  
  // Offers section
  offerAccepted: boolean('offer_accepted').notNull().default(true),
  offerRejected: boolean('offer_rejected').notNull().default(true),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userAddressIdx: index('user_notification_preferences_user_address_idx').on(table.userAddress),
}));

export interface UserNotificationPreferencesData {
  id: string;
  userAddress: string;
  newBidOnYourAuction: boolean;
  auctionEnding24h: boolean;
  auctionEnding1h: boolean;
  offerReceived: boolean;
  outbid: boolean;
  auctionWon: boolean;
  purchaseConfirmation: boolean;
  offerAccepted: boolean;
  offerRejected: boolean;
  createdAt: Date;
  updatedAt: Date;
}
