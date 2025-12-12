import { pgTable, integer, text, timestamp, jsonb, index, boolean, serial, bigint, uuid, pgEnum, primaryKey } from 'drizzle-orm/pg-core';

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
  tokenType: text('token_type'), // 'ERC721' | 'ERC1155'
  lastCheckedBlock: bigint('last_checked_block', { mode: 'number' }), // Last block checked for contract deployments (nullable)
  source: text('source').notNull(), // 'onchain' | 'alchemy' | 'manual'
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // TTL: 30 days
  refreshedAt: timestamp('refreshed_at'), // Manual refresh timestamp
}, (table) => ({
  creatorAddressIdx: index('contract_cache_creator_address_idx').on(table.creatorAddress),
  expiresAtIdx: index('contract_cache_expires_at_idx').on(table.expiresAt),
  lastCheckedBlockIdx: index('contract_cache_last_checked_block_idx').on(table.lastCheckedBlock),
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
  tokenType?: string | null;
  lastCheckedBlock?: number | null;
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

/**
 * Notification tokens table - Store Farcaster Mini App notification tokens
 * Used when self-hosting webhooks (not using Neynar managed service)
 * Each FID can have multiple tokens (one per client app)
 */
export const notificationTokens = pgTable('notification_tokens', {
  id: serial('id').primaryKey(),
  fid: integer('fid').notNull(), // Farcaster ID
  url: text('url').notNull(), // Notification URL from webhook
  token: text('token').notNull(), // Notification token from webhook
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  fidIdx: index('notification_tokens_fid_idx').on(table.fid),
  tokenIdx: index('notification_tokens_token_idx').on(table.token),
  // Composite index for quick lookups
  fidTokenIdx: index('notification_tokens_fid_token_idx').on(table.fid, table.token),
}));

// Type definitions for notifications
export type NotificationType = 
  | 'LISTING_CREATED'
  | 'NEW_BID'
  | 'AUCTION_WON'
  | 'AUCTION_ENDED_NO_BIDS'
  | 'AUCTION_ENDED_WON'
  | 'AUCTION_ENDED_READY_TO_FINALIZE'
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

export interface NotificationTokenData {
  id: number;
  fid: number;
  url: string;
  token: string;
  createdAt: Date;
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
 * Membership cache table - Cache membership NFT balance checks
 * Primary key: address (lowercase)
 * Used to avoid repeated onchain calls for membership checks
 */
export const membershipCache = pgTable('membership_cache', {
  address: text('address').primaryKey().notNull(), // ETH address (lowercase)
  hasMembership: boolean('has_membership').notNull(), // Whether balanceOf > 0
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // TTL: 5 minutes for positive, 1 minute for negative
}, (table) => ({
  expiresAtIdx: index('membership_cache_expires_at_idx').on(table.expiresAt),
  hasMembershipIdx: index('membership_cache_has_membership_idx').on(table.hasMembership),
}));

export interface MembershipCacheData {
  address: string;
  hasMembership: boolean;
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
// FEATURED SECTIONS
// ============================================

/**
 * Featured sections table - Dynamic sections for homepage curation
 */
export const featuredSections = pgTable('featured_sections', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(), // 'featured_artists', 'recently_sold', 'upcoming', 'collection', 'custom'
  title: text('title').notNull(),
  description: text('description'),
  config: jsonb('config'), // Type-specific configuration (JSONB)
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  displayOrderIdx: index('featured_sections_display_order_idx').on(table.displayOrder),
  isActiveIdx: index('featured_sections_is_active_idx').on(table.isActive),
  typeIdx: index('featured_sections_type_idx').on(table.type),
}));

export interface FeaturedSectionData {
  id: string;
  type: 'featured_artists' | 'recently_sold' | 'upcoming' | 'collection' | 'custom';
  title: string;
  description?: string | null;
  config?: Record<string, any> | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Featured section items table - Items within each section
 */
export const featuredSectionItems = pgTable('featured_section_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  sectionId: uuid('section_id').notNull().references(() => featuredSections.id, { onDelete: 'cascade' }),
  itemType: text('item_type').notNull(), // 'listing', 'artist', 'collection'
  itemId: text('item_id').notNull(), // Listing ID, artist address, or collection address
  displayOrder: integer('display_order').notNull().default(0),
  metadata: jsonb('metadata'), // Additional item metadata (JSONB)
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sectionIdIdx: index('featured_section_items_section_id_idx').on(table.sectionId),
  itemTypeIdx: index('featured_section_items_item_type_idx').on(table.itemType),
  itemIdIdx: index('featured_section_items_item_id_idx').on(table.itemId),
  displayOrderIdx: index('featured_section_items_display_order_idx').on(table.displayOrder),
}));

export interface FeaturedSectionItemData {
  id: string;
  sectionId: string;
  itemType: 'listing' | 'artist' | 'collection';
  itemId: string;
  displayOrder: number;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

// ============================================
// HOMEPAGE LAYOUT
// ============================================

/**
 * Homepage layout sections - explicit homepage ordering and configs
 */
export const homepageLayoutSections = pgTable('homepage_layout_sections', {
  id: uuid('id').defaultRandom().primaryKey(),
  sectionType: text('section_type').notNull(), // 'upcoming_auctions', 'recently_concluded', 'live_bids', 'artist', 'gallery', 'collector', 'listing', 'featured_carousel', 'custom_section'
  title: text('title'),
  description: text('description'),
  config: jsonb('config'), // Section-specific configuration
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  displayOrderIdx: index('homepage_layout_sections_display_order_idx').on(table.displayOrder),
  isActiveIdx: index('homepage_layout_sections_is_active_idx').on(table.isActive),
  sectionTypeIdx: index('homepage_layout_sections_type_idx').on(table.sectionType),
}));

export interface HomepageLayoutSectionData {
  id: string;
  sectionType:
    | 'upcoming_auctions'
    | 'recently_concluded'
    | 'live_bids'
    | 'artist'
    | 'gallery'
    | 'collector'
    | 'listing'
    | 'featured_carousel'
    | 'custom_section';
  title?: string | null;
  description?: string | null;
  config?: Record<string, any> | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// CURATION (Future)
// ============================================

/**
 * Curation table - For future curation features
 * This table is prepared for when we enable curated galleries/lists
 */
export const curation = pgTable('curation', {
  id: uuid('id').defaultRandom().primaryKey(),
  curatorAddress: text('curator_address').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  slug: text('slug'),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  curatorAddressIdx: index('curation_curator_address_idx').on(table.curatorAddress),
  slugIdx: index('curation_slug_idx').on(table.slug),
}));

export interface CurationData {
  id: string;
  curatorAddress: string;
  title: string;
  description?: string | null;
  slug?: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Curation items table - Listings within each curated gallery
 */
export const curationItems = pgTable('curation_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  curationId: uuid('curation_id').notNull().references(() => curation.id, { onDelete: 'cascade' }),
  listingId: text('listing_id').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  notes: text('notes'), // Optional curator comment about this listing
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (table) => ({
  curationIdIdx: index('curation_items_curation_id_idx').on(table.curationId),
  listingIdIdx: index('curation_items_listing_id_idx').on(table.listingId),
  displayOrderIdx: index('curation_items_display_order_idx').on(table.displayOrder),
  // Unique constraint: a listing can only appear once per gallery
  uniqueCurationListing: index('curation_items_curation_listing_unique_idx').on(table.curationId, table.listingId),
}));

export interface CurationItemData {
  id: string;
  curationId: string;
  listingId: string;
  displayOrder: number;
  notes?: string | null;
  addedAt: Date;
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

// ============================================
// ALLOWLIST: Pending Signatures
// ============================================

/**
 * Pending allowlist signatures table - Store signatures for the secure allowlist flow
 * 
 * Flow:
 * 1. User connects EOA on web, does SIWF to prove Farcaster identity
 * 2. Signs consent message with EOA, signature stored here
 * 3. Later in mini-app, membership wallet fetches and submits
 */
export const pendingAllowlistSignatures = pgTable('pending_allowlist_signatures', {
  id: uuid('id').defaultRandom().primaryKey(),
  fid: integer('fid').notNull(), // Farcaster ID of the user
  associatedAddress: text('associated_address').notNull(), // Address being added (lowercase)
  membershipHolder: text('membership_holder').notNull(), // Membership wallet (lowercase)
  signature: text('signature').notNull(), // ECDSA signature
  nonce: bigint('nonce', { mode: 'bigint' }).notNull(), // Contract nonce at time of signing
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // TTL: 7 days
  submittedAt: timestamp('submitted_at'), // When transaction was submitted
  transactionHash: text('transaction_hash'), // Transaction hash if submitted
}, (table) => ({
  fidIdx: index('pending_allowlist_signatures_fid_idx').on(table.fid),
  membershipHolderIdx: index('pending_allowlist_signatures_membership_holder_idx').on(table.membershipHolder),
  associatedAddressIdx: index('pending_allowlist_signatures_associated_address_idx').on(table.associatedAddress),
  expiresAtIdx: index('pending_allowlist_signatures_expires_at_idx').on(table.expiresAt),
  // Unique constraint: one pending signature per (associated, membership, nonce) tuple
  uniqueSignatureIdx: index('pending_allowlist_signatures_unique_idx').on(
    table.associatedAddress, 
    table.membershipHolder, 
    table.nonce
  ),
}));

export interface PendingAllowlistSignatureData {
  id: string;
  fid: number;
  associatedAddress: string;
  membershipHolder: string;
  signature: string;
  nonce: bigint;
  createdAt: Date;
  expiresAt: Date;
  submittedAt?: Date | null;
  transactionHash?: string | null;
}

// ============================================
// LISTING PAGE STATUS
// ============================================

/**
 * Listing page status table - Track when listing pages are ready to view
 * Used to show "building" state while page is being generated
 */
export const listingPageStatus = pgTable('listing_page_status', {
  listingId: text('listing_id').primaryKey().notNull(), // On-chain listing ID
  status: text('status').notNull().default('building'), // 'building' | 'ready' | 'error'
  sellerAddress: text('seller_address').notNull(), // Seller address for notifications
  createdAt: timestamp('created_at').defaultNow().notNull(),
  readyAt: timestamp('ready_at'), // When page became ready
  errorMessage: text('error_message'), // Error message if status is 'error'
  lastCheckedAt: timestamp('last_checked_at'), // Last time we checked if page is ready
}, (table) => ({
  statusIdx: index('listing_page_status_status_idx').on(table.status),
  sellerAddressIdx: index('listing_page_status_seller_address_idx').on(table.sellerAddress),
  createdAtIdx: index('listing_page_status_created_at_idx').on(table.createdAt),
}));

export type ListingPageStatus = 'building' | 'ready' | 'error';

export interface ListingPageStatusData {
  listingId: string;
  status: ListingPageStatus;
  sellerAddress: string;
  createdAt: Date;
  readyAt?: Date | null;
  errorMessage?: string | null;
  lastCheckedAt?: Date | null;
}

// ============================================
// TOKEN IMAGE CACHE
// ============================================

/**
 * Token image cache table - Cache ERC20 token logo images
 * Used to avoid repeated API calls to CoinGecko and other sources
 */
export const tokenImageCache = pgTable('token_image_cache', {
  tokenAddress: text('token_address').primaryKey().notNull(), // ERC20 token address (lowercase)
  imageUrl: text('image_url'), // Cached image URL (null if not found)
  expiresAt: timestamp('expires_at').notNull(), // Cache expiration (30 days)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  expiresAtIdx: index('token_image_cache_expires_at_idx').on(table.expiresAt),
}));

export interface TokenImageCacheData {
  tokenAddress: string;
  imageUrl: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// ERC1155 TOKEN SUPPLY CACHE
// ============================================

/**
 * ERC1155 token supply cache table - Cache total supply per tokenId
 * Primary key: composite of contractAddress (lowercase) + tokenId
 * Used to avoid repeated API calls and on-chain reads
 */
export const erc1155TokenSupplyCache = pgTable('erc1155_token_supply_cache', {
  contractAddress: text('contract_address').notNull(), // ERC1155 contract address (lowercase)
  tokenId: text('token_id').notNull(), // Token ID as string
  totalSupply: bigint('total_supply', { mode: 'bigint' }).notNull(), // Total supply for this tokenId
  isLazyMint: boolean('is_lazy_mint').notNull().default(false), // Flag for active lazy minting (allows refresh)
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // Cache expiration (30 days for non-lazy, 1 day for lazy)
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Composite primary key
  pk: primaryKey({ columns: [table.contractAddress, table.tokenId] }),
  contractAddressIdx: index('erc1155_token_supply_cache_contract_address_idx').on(table.contractAddress),
  expiresAtIdx: index('erc1155_token_supply_cache_expires_at_idx').on(table.expiresAt),
}));

export interface ERC1155TokenSupplyCacheData {
  contractAddress: string;
  tokenId: string;
  totalSupply: bigint;
  isLazyMint: boolean;
  cachedAt: Date;
  expiresAt: Date;
  updatedAt: Date;
}

// ============================================
// IPFS IMAGE CACHE
// ============================================

/**
 * IPFS image cache table - Cache IPFS images to Vercel Blob
 * Primary key: ipfs_url (normalized)
 * Used to avoid repeated IPFS gateway calls and serve images from CDN
 */
export const ipfsImageCache = pgTable('ipfs_image_cache', {
  ipfsUrl: text('ipfs_url').primaryKey().notNull(), // Normalized IPFS URL
  blobUrl: text('blob_url').notNull(), // Vercel Blob URL (CDN-optimized)
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // Optional TTL (null = never expires)
}, (table) => ({
  ipfsUrlIdx: index('ipfs_image_cache_ipfs_url_idx').on(table.ipfsUrl),
  expiresAtIdx: index('ipfs_image_cache_expires_at_idx').on(table.expiresAt),
}));

export interface IPFSImageCacheData {
  ipfsUrl: string;
  blobUrl: string;
  cachedAt: Date;
  expiresAt: Date | null;
}
