import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { nftCollections, collectionMints } from './schema';

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
  // subscriptionsCache, subscribersCache - commented out, focusing on basics
  // airdropLists, listRecipients, airdropHistory - commented out, will be used later
  // clankerTokens - commented out, not implemented yet
  nftCollections, 
  collectionMints, 
  auctionListings,
  auctionBids,
} from './schema';
// export type { SubscriptionCacheData, SubscriberCacheData } from './schema'; // Commented out with cache tables
