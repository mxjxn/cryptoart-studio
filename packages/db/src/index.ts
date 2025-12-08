export { 
  getDatabase,
  resetDatabaseConnection,
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
} from './client';
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

// Re-export common drizzle-orm functions to ensure type compatibility
export { eq, and, or, desc, asc, sql, count, lt, gt, gte, lte, ne, not, like, ilike, inArray, isNull, isNotNull } from 'drizzle-orm';
