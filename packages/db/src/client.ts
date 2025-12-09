import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  userCache, 
  contractCache, 
  notifications, 
  notificationPreferences,
  notificationTokens,
  notificationWorkerState, 
  imageCache, 
  follows, 
  favorites,
  // Admin tables
  featuredListings,
  featuredSettings,
  featuredSections,
  featuredSectionItems,
  curation,
  curationItems,
  hiddenUsers,
  analyticsSnapshots,
  errorLogs,
  errorLogTypeEnum,
  globalNotificationSettings,
  userNotificationPreferences,
  // Allowlist tables
  pendingAllowlistSignatures,
  // Listing page status
  listingPageStatus,
  // Token image cache
  tokenImageCache
} from './schema';

// Global singleton pattern for Next.js serverless environments
// This ensures we reuse the same connection pool across all function invocations
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle> | null;
  client: ReturnType<typeof postgres> | null;
  connectionString: string | null;
};

// Initialize global state if it doesn't exist
if (!globalForDb.db) {
  globalForDb.db = null;
  globalForDb.client = null;
  globalForDb.connectionString = null;
}

/**
 * Reset the database connection
 * Useful when connections are closed in serverless environments
 */
export function resetDatabaseConnection() {
  if (globalForDb.client) {
    try {
      globalForDb.client.end({ timeout: 5 });
    } catch (error) {
      // Ignore errors when closing
    }
  }
  globalForDb.client = null;
  globalForDb.db = null;
  globalForDb.connectionString = null;
}

/**
 * Check if the connection is still alive
 */
async function isConnectionAlive(client: ReturnType<typeof postgres>): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export function getDatabase() {
  // Support both STORAGE_POSTGRES_URL (Supabase) and POSTGRES_URL for backward compatibility
  const connectionString = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('STORAGE_POSTGRES_URL or POSTGRES_URL environment variable is required');
  }
  
  // Check if we need to recreate the connection
  const needsReconnect = 
    !globalForDb.client || 
    !globalForDb.db || 
    globalForDb.connectionString !== connectionString;
  
  if (needsReconnect) {
    // Close existing connection if it exists
    if (globalForDb.client) {
      try {
        globalForDb.client.end({ timeout: 5 });
      } catch (error) {
        // Ignore errors when closing
      }
    }
    
    // Determine if we're using a pooled connection string
    // Supabase pooler uses port 6543 and includes ?pgbouncer=true
    const isPooledConnection = 
      connectionString.includes(':6543') || 
      connectionString.includes('pgbouncer=true') ||
      connectionString.includes('pooler.supabase.com');
    
    // Create postgres client with optimized connection pooling for serverless
    // CRITICAL: Use max: 1-2 for serverless to prevent connection exhaustion
    // Each serverless function instance can spawn multiple concurrent requests
    // With 10 instances × 1 connection = 10 total (much safer than 10 × 10 = 100)
    // In development, use even fewer connections to avoid hitting database limits
    const isDevelopment = process.env.NODE_ENV === 'development';
    const maxConnections = isDevelopment 
      ? 1  // Single connection in dev to avoid hitting limits
      : (isPooledConnection ? 2 : 3); // 2 for pooled, 3 for direct in production
    
    globalForDb.client = postgres(connectionString, {
      max: maxConnections,
      idle_timeout: isDevelopment ? 5 : 10, // Close idle connections faster in dev (5 seconds)
      connect_timeout: 5, // Faster connection timeout
      // Enable automatic reconnection on connection errors
      onnotice: () => {}, // Suppress notices
      // Transform errors to be more informative
      transform: {
        undefined: null,
      },
    });
    
    globalForDb.db = drizzle(globalForDb.client);
    globalForDb.connectionString = connectionString;
  }
  
  // At this point, db is guaranteed to be non-null
  // because we just created it if it didn't exist
  if (!globalForDb.db) {
    throw new Error('Database connection failed to initialize');
  }
  
  return globalForDb.db;
}

// Export schema for use in other packages
export { 
  userCache, 
  contractCache,
  notifications,
  notificationPreferences,
  notificationTokens,
  notificationWorkerState,
  imageCache,
  follows,
  favorites,
  // Admin tables
  featuredListings,
  featuredSettings,
  featuredSections,
  featuredSectionItems,
  curation,
  curationItems,
  hiddenUsers,
  analyticsSnapshots,
  errorLogs,
  errorLogTypeEnum,
  globalNotificationSettings,
  userNotificationPreferences,
  // Allowlist tables
  pendingAllowlistSignatures,
  // Listing page status
  listingPageStatus,
  // Token image cache
  tokenImageCache
} from './schema';
export type { 
  UserCacheData, 
  ContractCacheData,
  NotificationData,
  NotificationPreferencesData,
  NotificationTokenData,
  NotificationType,
  NotificationWorkerStateData,
  ImageCacheData,
  FollowData,
  FavoriteData,
  // Admin types
  FeaturedListingData,
  FeaturedSettingsData,
  FeaturedSectionData,
  FeaturedSectionItemData,
  CurationData,
  CurationItemData,
  HiddenUserData,
  AnalyticsSnapshotData,
  ErrorLogType,
  ErrorLogData,
  GlobalNotificationSettingsData,
  UserNotificationPreferencesData,
  // Allowlist types
  PendingAllowlistSignatureData,
  // Token image cache types
  TokenImageCacheData
} from './schema';
