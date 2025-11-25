export { 
  getDatabase, 
  subscriptionsCache, 
  subscribersCache,
  airdropLists,
  listRecipients,
  airdropHistory,
  nftCollections,
  collectionMints,
  clankerTokens,
  suchGalleryUsers,
  curatedGalleries,
  curatedGalleryNfts,
  nftMetadataCache,
  quoteCasts,
  adminUsers,
  creatorCoreContracts,
  creatorCoreTokens,
  creatorCoreTransfers
} from './client';
export type { SubscriptionCacheData, SubscriberCacheData } from './schema';

// Re-export common drizzle-orm functions to ensure type compatibility
export { eq, and, or, desc, asc, sql, count, lt, gt, gte, lte, ne, not, like, ilike, inArray } from 'drizzle-orm';
