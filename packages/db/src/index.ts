export { 
  getDatabase, 
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
  userNotificationPreferences
} from './client';
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
  UserNotificationPreferencesData
} from './schema';

// Re-export common drizzle-orm functions to ensure type compatibility
export { eq, and, or, desc, asc, sql, count, lt, gt, gte, lte, ne, not, like, ilike, inArray } from 'drizzle-orm';
