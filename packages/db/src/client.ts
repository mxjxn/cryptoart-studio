import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  userCache, 
  contractCache, 
  notifications, 
  notificationPreferences, 
  notificationWorkerState, 
  imageCache, 
  follows, 
  favorites,
  // Admin tables
  featuredListings,
  featuredSettings,
  hiddenUsers,
  analyticsSnapshots,
  errorLogs,
  errorLogTypeEnum,
  globalNotificationSettings,
  userNotificationPreferences,
  // Allowlist tables
  pendingAllowlistSignatures
} from './schema';

// Database client singleton
let db: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

/**
 * Reset the database connection
 * Useful when connections are closed in serverless environments
 */
export function resetDatabaseConnection() {
  if (client) {
    try {
      client.end({ timeout: 5 });
    } catch (error) {
      // Ignore errors when closing
    }
  }
  client = null;
  db = null;
}

export function getDatabase() {
  // Support both STORAGE_POSTGRES_URL (Supabase) and POSTGRES_URL for backward compatibility
  const connectionString = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('STORAGE_POSTGRES_URL or POSTGRES_URL environment variable is required');
  }
  
  // Recreate connection if it doesn't exist
  // In serverless environments, the module may be cached but connections can be closed
  if (!client || !db) {
    // Create postgres client with connection pooling for serverless environments
    // This configuration works well with Supabase's connection pooler (port 6543)
    client = postgres(connectionString, {
      max: 10, // Maximum number of connections in the pool
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Connection timeout in seconds
      // Enable automatic reconnection on connection errors
      onnotice: () => {}, // Suppress notices
    });
    
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
  notificationWorkerState,
  imageCache,
  follows,
  favorites,
  // Admin tables
  featuredListings,
  featuredSettings,
  hiddenUsers,
  analyticsSnapshots,
  errorLogs,
  errorLogTypeEnum,
  globalNotificationSettings,
  userNotificationPreferences,
  // Allowlist tables
  pendingAllowlistSignatures
} from './schema';
export type { 
  UserCacheData, 
  ContractCacheData,
  NotificationData,
  NotificationPreferencesData,
  NotificationType,
  NotificationWorkerStateData,
  ImageCacheData,
  FollowData,
  FavoriteData,
  // Admin types
  FeaturedListingData,
  FeaturedSettingsData,
  HiddenUserData,
  AnalyticsSnapshotData,
  ErrorLogType,
  ErrorLogData,
  GlobalNotificationSettingsData,
  UserNotificationPreferencesData,
  // Allowlist types
  PendingAllowlistSignatureData
} from './schema';
