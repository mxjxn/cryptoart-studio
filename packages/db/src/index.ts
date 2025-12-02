export { 
  getDatabase, 
  userCache, 
  contractCache,
  notifications,
  notificationPreferences,
  notificationWorkerState
} from './client';
export type { 
  UserCacheData, 
  ContractCacheData,
  NotificationData,
  NotificationPreferencesData,
  NotificationType,
  NotificationWorkerStateData
} from './schema';

// Re-export common drizzle-orm functions to ensure type compatibility
export { eq, and, or, desc, asc, sql, count, lt, gt, gte, lte, ne, not, like, ilike, inArray } from 'drizzle-orm';
