import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { subscriptionsCache, subscribersCache, airdropLists, listRecipients, airdropHistory, nftCollections, collectionMints, clankerTokens, suchGalleryUsers, curatedGalleries, curatedGalleryNfts, nftMetadataCache, quoteCasts, adminUsers, creatorCoreContracts, creatorCoreTokens, creatorCoreTransfers } from './schema';

// Database client singleton
let db: ReturnType<typeof drizzle> | null = null;

export function getDatabase() {
  if (!db) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('POSTGRES_URL environment variable is required');
    }
    
    const client = postgres(connectionString);
    db = drizzle(client);
  }
  return db;
}

// Export schema for use in other packages
export { 
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
} from './schema';
export type { SubscriptionCacheData, SubscriberCacheData } from './schema';
