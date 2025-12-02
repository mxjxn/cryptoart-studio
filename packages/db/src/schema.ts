import { pgTable, integer, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * Artist/User cache table - Cache artist/user information from Neynar, ENS, etc.
 * Primary key: eth_address (lowercase)
 */
export const artistCache = pgTable('artist_cache', {
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
  fidIdx: index('artist_cache_fid_idx').on(table.fid),
  usernameIdx: index('artist_cache_username_idx').on(table.username),
  expiresAtIdx: index('artist_cache_expires_at_idx').on(table.expiresAt),
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
export interface ArtistCacheData {
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
