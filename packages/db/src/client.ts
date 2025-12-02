import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { userCache, contractCache, notifications, notificationPreferences, notificationWorkerState } from './schema.js';

// Database client singleton
let db: ReturnType<typeof drizzle> | null = null;

export function getDatabase() {
  if (!db) {
    // Support both STORAGE_POSTGRES_URL (Supabase) and POSTGRES_URL for backward compatibility
    const connectionString = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('STORAGE_POSTGRES_URL or POSTGRES_URL environment variable is required');
    }
    
    const client = postgres(connectionString);
    db = drizzle(client);
  }
  return db;
}

// Export schema for use in other packages
export { 
  userCache, 
  contractCache,
  notifications,
  notificationPreferences,
  notificationWorkerState
} from './schema.js';
export type { 
  UserCacheData, 
  ContractCacheData,
  NotificationData,
  NotificationPreferencesData,
  NotificationType,
  NotificationWorkerStateData
} from './schema.js';
