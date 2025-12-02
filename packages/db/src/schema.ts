import { pgTable, integer, text, timestamp, jsonb, index, boolean, serial, bigint } from 'drizzle-orm/pg-core';

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
  | 'LISTING_MODIFIED';

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
