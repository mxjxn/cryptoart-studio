import { pgTable, serial, integer, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

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
