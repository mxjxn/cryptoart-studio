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

// ============================================================================
// SOCIAL FEATURES - Cross-platform social layer
// ============================================================================

// User profiles - unified profile across all platforms
export const userProfiles = pgTable('user_profiles', {
  fid: integer('fid').primaryKey(),
  username: text('username'),
  displayName: text('display_name'),
  avatar: text('avatar'),
  bio: text('bio'),
  verifiedAddresses: jsonb('verified_addresses'), // Array of addresses
  metadata: jsonb('metadata'), // Additional Farcaster data
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  usernameIdx: index('user_profiles_username_idx').on(table.username),
}));

// Reputation scores - cross-platform reputation system
export const reputationScores = pgTable('reputation_scores', {
  fid: integer('fid').primaryKey().references(() => userProfiles.fid),

  // Creator metrics (cryptoart.social)
  creatorScore: integer('creator_score').default(0).notNull(),
  collectionsDeployed: integer('collections_deployed').default(0).notNull(),
  totalMinted: integer('total_minted').default(0).notNull(),
  creatorRevenue: text('creator_revenue').default('0').notNull(), // bigint as string
  uniqueCollectors: integer('unique_collectors').default(0).notNull(),

  // Trader metrics (such.market)
  traderScore: integer('trader_score').default(0).notNull(),
  tradeVolume: text('trade_volume').default('0').notNull(), // bigint as string
  poolsCreated: integer('pools_created').default(0).notNull(),
  lpFeesEarned: text('lp_fees_earned').default('0').notNull(), // bigint as string

  // Collector metrics (such.gallery)
  collectorScore: integer('collector_score').default(0).notNull(),
  totalSpent: text('total_spent').default('0').notNull(), // bigint as string
  auctionsWon: integer('auctions_won').default(0).notNull(),
  itemsCollected: integer('items_collected').default(0).notNull(),

  // Curator metrics (such.gallery)
  curatorScore: integer('curator_score').default(0).notNull(),
  galleriesCurated: integer('galleries_curated').default(0).notNull(),
  referralRevenue: text('referral_revenue').default('0').notNull(), // bigint as string
  referralConversions: integer('referral_conversions').default(0).notNull(),

  // Overall
  overallRank: integer('overall_rank'),
  badges: jsonb('badges'), // Array of badge objects
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
}, (table) => ({
  creatorScoreIdx: index('reputation_scores_creator_score_idx').on(table.creatorScore),
  traderScoreIdx: index('reputation_scores_trader_score_idx').on(table.traderScore),
  collectorScoreIdx: index('reputation_scores_collector_score_idx').on(table.collectorScore),
  curatorScoreIdx: index('reputation_scores_curator_score_idx').on(table.curatorScore),
  overallRankIdx: index('reputation_scores_overall_rank_idx').on(table.overallRank),
}));

// Patronage relationships - collector-creator relationships
export const patronships = pgTable('patronships', {
  id: serial('id').primaryKey(),
  collectorFid: integer('collector_fid').notNull().references(() => userProfiles.fid),
  creatorFid: integer('creator_fid').notNull().references(() => userProfiles.fid),

  // Purchase tracking
  firstPurchase: timestamp('first_purchase').notNull(),
  lastPurchase: timestamp('last_purchase').notNull(),
  totalSpent: text('total_spent').default('0').notNull(), // bigint as string
  itemsOwned: integer('items_owned').default(0).notNull(),

  // Platform breakdown
  marketPurchases: integer('market_purchases').default(0).notNull(), // From such.market (LSSVM)
  galleryPurchases: integer('gallery_purchases').default(0).notNull(), // From such.gallery (auctions)

  // Status
  patronTier: text('patron_tier').notNull(), // 'supporter' | 'collector' | 'patron' | 'whale'
  isTopPatron: boolean('is_top_patron').default(false).notNull(), // Top 3 for this creator

  // Social
  metadata: jsonb('metadata'), // Custom notes, relationship data

  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueRelationship: unique('patronships_unique_relationship').on(table.collectorFid, table.creatorFid),
  collectorFidIdx: index('patronships_collector_fid_idx').on(table.collectorFid),
  creatorFidIdx: index('patronships_creator_fid_idx').on(table.creatorFid),
  patronTierIdx: index('patronships_patron_tier_idx').on(table.patronTier),
  isTopPatronIdx: index('patronships_is_top_patron_idx').on(table.isTopPatron),
  totalSpentIdx: index('patronships_total_spent_idx').on(table.totalSpent),
}));

// Auction completions cache - recently finished auctions with rich metadata
export const auctionCompletionsCache = pgTable('auction_completions_cache', {
  id: serial('id').primaryKey(),
  listingId: text('listing_id').notNull().unique(), // BigInt as string

  // NFT details
  tokenContract: text('token_contract').notNull(),
  tokenId: text('token_id').notNull(),
  nftMetadata: jsonb('nft_metadata'), // {name, image, description, attributes}

  // Auction details
  finalBid: text('final_bid').notNull(), // bigint as string
  bidCount: integer('bid_count').default(0).notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  completedAt: timestamp('completed_at').notNull(),

  // Participants
  seller: text('seller').notNull(),
  sellerFid: integer('seller_fid'),
  winner: text('winner').notNull(),
  winnerFid: integer('winner_fid'),

  // Attribution
  referrer: text('referrer'),
  curatorFid: integer('curator_fid'),
  curatorEarnings: text('curator_earnings'), // bigint as string

  // Social flags
  featured: boolean('featured').default(false).notNull(),
  isFirstWin: boolean('is_first_win').default(false).notNull(), // Winner's first auction?
  isRecordPrice: boolean('is_record_price').default(false).notNull(), // Highest for this creator?

  // Cache management
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // Cache for 30 days
}, (table) => ({
  listingIdIdx: index('auction_completions_cache_listing_id_idx').on(table.listingId),
  completedAtIdx: index('auction_completions_cache_completed_at_idx').on(table.completedAt),
  winnerFidIdx: index('auction_completions_cache_winner_fid_idx').on(table.winnerFid),
  sellerFidIdx: index('auction_completions_cache_seller_fid_idx').on(table.sellerFid),
  curatorFidIdx: index('auction_completions_cache_curator_fid_idx').on(table.curatorFid),
  tokenContractIdx: index('auction_completions_cache_token_contract_idx').on(table.tokenContract),
  expiresAtIdx: index('auction_completions_cache_expires_at_idx').on(table.expiresAt),
  featuredIdx: index('auction_completions_cache_featured_idx').on(table.featured),
}));

// Market swaps cache - LSSVM pool trades for such.market integration
export const marketSwapsCache = pgTable('market_swaps_cache', {
  id: serial('id').primaryKey(),
  txHash: text('tx_hash').notNull().unique(),

  // Pool info
  poolAddress: text('pool_address').notNull(),
  poolType: text('pool_type').notNull(), // LINEAR, EXPONENTIAL, XYK, GDA

  // NFT details
  nftContract: text('nft_contract').notNull(),
  tokenIds: jsonb('token_ids').notNull(), // Array of token IDs for batch swaps

  // Trade details
  trader: text('trader').notNull(),
  traderFid: integer('trader_fid'),
  isBuy: boolean('is_buy').notNull(),
  ethAmount: text('eth_amount').notNull(), // bigint as string
  nftAmount: integer('nft_amount').notNull(),
  spotPrice: text('spot_price').notNull(), // bigint as string

  // Fees
  poolFee: text('pool_fee'), // bigint as string
  protocolFee: text('protocol_fee'), // bigint as string

  // Timing
  timestamp: timestamp('timestamp').notNull(),
  blockNumber: integer('block_number').notNull(),

  // Cache management
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // Cache for 30 days
}, (table) => ({
  txHashIdx: index('market_swaps_cache_tx_hash_idx').on(table.txHash),
  poolAddressIdx: index('market_swaps_cache_pool_address_idx').on(table.poolAddress),
  traderFidIdx: index('market_swaps_cache_trader_fid_idx').on(table.traderFid),
  nftContractIdx: index('market_swaps_cache_nft_contract_idx').on(table.nftContract),
  timestampIdx: index('market_swaps_cache_timestamp_idx').on(table.timestamp),
  expiresAtIdx: index('market_swaps_cache_expires_at_idx').on(table.expiresAt),
}));

// Achievements/badges - gamification system
export const achievements = pgTable('achievements', {
  id: serial('id').primaryKey(),
  fid: integer('fid').notNull().references(() => userProfiles.fid),

  // Badge details
  badgeType: text('badge_type').notNull(), // 'first_win', 'whale', 'patron', etc.
  badgeCategory: text('badge_category').notNull(), // 'collector', 'trader', 'curator', 'creator'
  platform: text('platform').notNull(), // 'market', 'gallery', 'social', 'all'

  // When earned
  awardedAt: timestamp('awarded_at').defaultNow().notNull(),
  metadata: jsonb('metadata'), // Custom badge data (thresholds, specific achievement details)
}, (table) => ({
  uniqueBadge: unique('achievements_unique_badge').on(table.fid, table.badgeType),
  fidIdx: index('achievements_fid_idx').on(table.fid),
  badgeTypeIdx: index('achievements_badge_type_idx').on(table.badgeType),
  badgeCategoryIdx: index('achievements_badge_category_idx').on(table.badgeCategory),
  platformIdx: index('achievements_platform_idx').on(table.platform),
}));

// Curator performance tracking - for curators to see their impact
export const curatorPerformance = pgTable('curator_performance', {
  id: serial('id').primaryKey(),
  curatorFid: integer('curator_fid').notNull().references(() => userProfiles.fid),
  galleryId: integer('gallery_id').references(() => curatedGalleries.id),

  // Engagement metrics
  views: integer('views').default(0).notNull(),
  uniqueViewers: integer('unique_viewers').default(0).notNull(),
  shares: integer('shares').default(0).notNull(),

  // Conversion metrics
  referralClicks: integer('referral_clicks').default(0).notNull(),
  referralSales: integer('referral_sales').default(0).notNull(),
  conversionRate: text('conversion_rate').default('0').notNull(), // Stored as percentage string

  // Revenue breakdown
  totalReferralRevenue: text('total_referral_revenue').default('0').notNull(), // bigint as string
  marketReferrals: text('market_referrals').default('0').notNull(), // From LSSVM
  galleryReferrals: text('gallery_referrals').default('0').notNull(), // From auctions

  // Timing
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
}, (table) => ({
  uniqueCuratorGallery: unique('curator_performance_unique_curator_gallery').on(table.curatorFid, table.galleryId),
  curatorFidIdx: index('curator_performance_curator_fid_idx').on(table.curatorFid),
  galleryIdIdx: index('curator_performance_gallery_id_idx').on(table.galleryId),
}));
