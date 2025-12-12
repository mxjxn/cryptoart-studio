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
  membershipCache,
  follows,
  favorites,
  // Admin tables
  featuredListings,
  featuredSettings,
  featuredSections,
  featuredSectionItems,
  homepageLayoutSections,
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
  tokenImageCache,
  // ERC1155 token supply cache
  erc1155TokenSupplyCache,
  // IPFS image cache
  ipfsImageCache,
  // User statistics
  userStats
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
  MembershipCacheData,
  FollowData,
  FavoriteData,
  // Admin types
  FeaturedListingData,
  FeaturedSettingsData,
  FeaturedSectionData,
  FeaturedSectionItemData,
  HomepageLayoutSectionData,
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
  TokenImageCacheData,
  // ERC1155 token supply cache types
  ERC1155TokenSupplyCacheData,
  // IPFS image cache types
  IPFSImageCacheData,
  // User statistics types
  UserStatsData,
  TokenStats
} from './schema';

// Re-export common drizzle-orm functions to ensure type compatibility
export { eq, and, or, desc, asc, sql, count, lt, gt, gte, lte, ne, not, like, ilike, inArray, isNull, isNotNull } from 'drizzle-orm';
