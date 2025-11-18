import { pgTable, serial, integer, text, timestamp, jsonb, index, unique, boolean } from 'drizzle-orm/pg-core';

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

// Such Gallery tables

// Users - minimal user data (FID primary, optional wallet)
export const suchGalleryUsers = pgTable('such_gallery_users', {
  fid: integer('fid').primaryKey(),
  ethAddress: text('eth_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  ethAddressIdx: index('such_gallery_users_eth_address_idx').on(table.ethAddress),
}));

// Curated galleries - user-created curation lists (renamed from "collections" to avoid confusion with Creator Core collections)
export const curatedGalleries = pgTable('curated_galleries', {
  id: serial('id').primaryKey(),
  curatorFid: integer('curator_fid').notNull().references(() => suchGalleryUsers.fid),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  isPublished: boolean('is_published').default(false).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  curatorFidIdx: index('curated_galleries_curator_fid_idx').on(table.curatorFid),
  curatorSlugIdx: index('curated_galleries_curator_slug_idx').on(table.curatorFid, table.slug),
}));

// Curated gallery NFTs - links NFTs to galleries with curator metadata
export const curatedGalleryNfts = pgTable('curated_gallery_nfts', {
  curatedGalleryId: integer('curated_gallery_id').notNull().references(() => curatedGalleries.id, { onDelete: 'cascade' }),
  contractAddress: text('contract_address').notNull(),
  tokenId: text('token_id').notNull(),
  curatorComment: text('curator_comment'),
  showDescription: boolean('show_description').default(true).notNull(),
  showAttributes: boolean('show_attributes').default(false).notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (table) => ({
  pk: unique('curated_gallery_nfts_pk').on(table.curatedGalleryId, table.contractAddress, table.tokenId),
  galleryIdx: index('curated_gallery_nfts_gallery_idx').on(table.curatedGalleryId),
  contractTokenIdx: index('curated_gallery_nfts_contract_token_idx').on(table.contractAddress, table.tokenId),
}));

// NFT metadata cache - cached NFT metadata with manual refresh
export const nftMetadataCache = pgTable('nft_metadata_cache', {
  id: serial('id').primaryKey(),
  contractAddress: text('contract_address').notNull(),
  tokenId: text('token_id').notNull(),
  name: text('name'),
  description: text('description'),
  imageURI: text('image_uri'),
  animationURI: text('animation_uri'),
  attributes: jsonb('attributes'),
  tokenURI: text('token_uri'),
  metadataSource: text('metadata_source').notNull(), // 'alchemy' | 'ipfs' | 'contract'
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  refreshedAt: timestamp('refreshed_at'),
}, (table) => ({
  contractTokenIdx: index('nft_metadata_cache_contract_token_idx').on(table.contractAddress, table.tokenId),
  uniqueContractToken: unique('nft_metadata_cache_unique_contract_token_idx').on(table.contractAddress, table.tokenId),
}));

// Quote casts - track quote-casts for galleries/NFTs (for referral tracking)
export const quoteCasts = pgTable('quote_casts', {
  id: serial('id').primaryKey(),
  curatorFid: integer('curator_fid').notNull().references(() => suchGalleryUsers.fid),
  castHash: text('cast_hash').notNull(),
  targetType: text('target_type').notNull(), // 'gallery' | 'nft'
  targetGalleryId: integer('target_gallery_id').references(() => curatedGalleries.id),
  targetContractAddress: text('target_contract_address'),
  targetTokenId: text('target_token_id'),
  referralAddress: text('referral_address').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  curatorFidIdx: index('quote_casts_curator_fid_idx').on(table.curatorFid),
  castHashIdx: index('quote_casts_cast_hash_idx').on(table.castHash),
  targetGalleryIdx: index('quote_casts_target_gallery_idx').on(table.targetGalleryId),
  targetNftIdx: index('quote_casts_target_nft_idx').on(table.targetContractAddress, table.targetTokenId),
}));

// Admin users - admin FIDs for metadata refresh permissions
export const adminUsers = pgTable('admin_users', {
  fid: integer('fid').primaryKey(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Creator Core Contracts - track all deployed Creator Core contracts
export const creatorCoreContracts = pgTable('creator_core_contracts', {
  id: serial('id').primaryKey(),
  contractAddress: text('contract_address').notNull().unique(),
  contractType: text('contract_type').notNull(), // 'ERC721' | 'ERC1155' | 'ERC6551'
  creatorFid: integer('creator_fid'),
  deployerAddress: text('deployer_address').notNull(),
  deployTxHash: text('deploy_tx_hash'),
  implementationAddress: text('implementation_address'),
  proxyAdminAddress: text('proxy_admin_address'),
  isUpgradeable: boolean('is_upgradeable').default(false).notNull(),
  name: text('name'),
  symbol: text('symbol'),
  chainId: integer('chain_id').notNull(),
  deployedAt: timestamp('deployed_at'),
  deployedAtBlock: integer('deployed_at_block'),
  metadata: jsonb('metadata'), // baseURI, royalties, etc.
}, (table) => ({
  contractAddressIdx: index('creator_core_contracts_contract_address_idx').on(table.contractAddress),
  creatorFidIdx: index('creator_core_contracts_creator_fid_idx').on(table.creatorFid),
  contractTypeIdx: index('creator_core_contracts_contract_type_idx').on(table.contractType),
  chainIdIdx: index('creator_core_contracts_chain_id_idx').on(table.chainId),
}));

// Creator Core Tokens - track individual NFTs minted
export const creatorCoreTokens = pgTable('creator_core_tokens', {
  id: serial('id').primaryKey(),
  contractAddress: text('contract_address').notNull(),
  tokenId: text('token_id').notNull(),
  mintTxHash: text('mint_tx_hash'),
  mintedBy: text('minted_by').notNull(),
  mintedAt: timestamp('minted_at'),
  mintedAtBlock: integer('minted_at_block'),
  currentOwner: text('current_owner'),
  tokenURI: text('token_uri'),
  metadata: jsonb('metadata'), // Full metadata: name, description, image, attributes
  extensionAddress: text('extension_address'),
  totalSupply: text('total_supply'), // For ERC1155
}, (table) => ({
  contractTokenUnique: unique('creator_core_tokens_contract_token_unique').on(table.contractAddress, table.tokenId),
  contractAddressIdx: index('creator_core_tokens_contract_address_idx').on(table.contractAddress),
  tokenIdIdx: index('creator_core_tokens_token_id_idx').on(table.tokenId),
  currentOwnerIdx: index('creator_core_tokens_current_owner_idx').on(table.currentOwner),
  extensionAddressIdx: index('creator_core_tokens_extension_address_idx').on(table.extensionAddress),
}));

// Creator Core Transfers - track all transfer events
export const creatorCoreTransfers = pgTable('creator_core_transfers', {
  id: serial('id').primaryKey(),
  contractAddress: text('contract_address').notNull(),
  tokenId: text('token_id').notNull(),
  from: text('from').notNull(),
  to: text('to').notNull(),
  amount: text('amount').notNull(), // For ERC1155, "1" for ERC721
  txHash: text('tx_hash').notNull(),
  blockNumber: integer('block_number').notNull(),
  timestamp: timestamp('timestamp'),
  logIndex: integer('log_index').notNull(),
}, (table) => ({
  contractTokenIdx: index('creator_core_transfers_contract_token_idx').on(table.contractAddress, table.tokenId),
  txHashIdx: index('creator_core_transfers_tx_hash_idx').on(table.txHash),
  blockNumberIdx: index('creator_core_transfers_block_number_idx').on(table.blockNumber),
  fromIdx: index('creator_core_transfers_from_idx').on(table.from),
  toIdx: index('creator_core_transfers_to_idx').on(table.to),
}));

// Creator Core Extensions - track extension registrations
export const creatorCoreExtensions = pgTable('creator_core_extensions', {
  id: serial('id').primaryKey(),
  contractAddress: text('contract_address').notNull(),
  extensionAddress: text('extension_address').notNull(),
  baseURI: text('base_uri'),
  registeredAt: timestamp('registered_at'),
  registeredAtBlock: integer('registered_at_block'),
  unregisteredAt: timestamp('unregistered_at'),
  unregisteredAtBlock: integer('unregistered_at_block'),
  isBlacklisted: boolean('is_blacklisted').default(false).notNull(),
}, (table) => ({
  contractExtensionUnique: unique('creator_core_extensions_contract_extension_unique').on(table.contractAddress, table.extensionAddress),
  contractAddressIdx: index('creator_core_extensions_contract_address_idx').on(table.contractAddress),
  extensionAddressIdx: index('creator_core_extensions_extension_address_idx').on(table.extensionAddress),
}));
