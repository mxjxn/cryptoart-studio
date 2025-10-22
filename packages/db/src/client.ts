import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql } from '@vercel/postgres';
import { subscriptionsCache, subscribersCache } from './schema';

// Database client singleton
let db: ReturnType<typeof drizzle> | null = null;

export function getDatabase() {
  if (!db) {
    db = drizzle(sql);
  }
  return db;
}

// Export schema for use in other packages
export { subscriptionsCache, subscribersCache } from './schema';
export type { SubscriptionCacheData, SubscriberCacheData } from './schema';
