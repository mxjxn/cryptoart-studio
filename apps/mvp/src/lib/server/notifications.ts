import { 
  getDatabase, 
  notifications, 
  notificationPreferences,
  type NotificationData,
  type NotificationPreferencesData,
  type NotificationType,
  eq,
  desc,
  and,
  gte
} from '@cryptoart/db';
import { sendPushNotification } from './neynar-notifications';
import { getUserFromCache } from './user-cache';
import { lookupNeynarByAddress } from '~/lib/artist-name-resolution';

/**
 * Check for duplicate notification within the last hour
 */
async function checkDuplicateNotification(
  userAddress: string,
  type: NotificationType,
  listingId?: string
): Promise<NotificationData | null> {
  const db = getDatabase();
  const normalizedAddress = userAddress.toLowerCase();
  
  const conditions = [
    eq(notifications.userAddress, normalizedAddress),
    eq(notifications.type, type),
    // Check created within last hour to avoid duplicates
    gte(notifications.createdAt, new Date(Date.now() - 3600000)),
  ];
  
  if (listingId) {
    conditions.push(eq(notifications.listingId, listingId));
  }
  
  const [existing] = await db.select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(1);
  
  return (existing as NotificationData | undefined) || null;
}

/**
 * Auto-fetch FID if missing
 */
async function ensureFID(
  userAddress: string,
  fid?: number
): Promise<number | undefined> {
  if (fid) return fid;
  
  // Check cache first
  const cached = await getUserFromCache(userAddress);
  if (cached?.fid) {
    return cached.fid;
  }
  
  // Fetch from Neynar
  const neynar = await lookupNeynarByAddress(userAddress);
  return neynar?.fid;
}

/**
 * Create a new notification
 */
export async function createNotification(
  userAddress: string,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    fid?: number;
    listingId?: string;
    metadata?: Record<string, any>;
    sendPush?: boolean;
  }
): Promise<NotificationData> {
  const db = getDatabase();
  
  // Check for duplicate notification
  const duplicate = await checkDuplicateNotification(
    userAddress,
    type,
    options?.listingId
  );
  
  if (duplicate) {
    console.log(`[notifications] Duplicate notification detected, returning existing:`, {
      userAddress,
      type,
      listingId: options?.listingId,
    });
    return duplicate;
  }
  
  // Auto-fetch FID if missing
  const fid = await ensureFID(userAddress, options?.fid);
  
  // Get user preferences
  const preferences = await getNotificationPreferences(userAddress);
  
  // Create notification if in-app is enabled
  let notification: NotificationData | null = null;
  if (preferences.inAppEnabled) {
    const [result] = await db.insert(notifications).values({
      userAddress: userAddress.toLowerCase(),
      fid: fid, // Use auto-fetched FID
      type,
      listingId: options?.listingId,
      title,
      message,
      metadata: options?.metadata || null,
      read: false,
      pushed: false,
    }).returning();
    
    notification = result as NotificationData;
  }
  
  // Send push notification if enabled and requested
  if (preferences.pushEnabled && (options?.sendPush !== false)) {
    try {
      // Build target URL for the notification
      const targetUrl = options?.listingId 
        ? `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/listing/${options.listingId}`
        : `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/notifications`;
      
      await sendPushNotification(userAddress, fid, title, message, {
        type,
        listingId: options?.listingId,
        metadata: options?.metadata,
        targetUrl,
      });
      
      // Mark as pushed if notification was created
      if (notification) {
        await db.update(notifications)
          .set({ pushed: true })
          .where(eq(notifications.id, notification.id));
        notification.pushed = true;
      }
    } catch (error) {
      console.error(`[notifications] Failed to send push notification to ${userAddress}:`, error);
      // Don't throw - in-app notification was created successfully
    }
  }
  
  if (!notification) {
    throw new Error('Failed to create notification');
  }
  
  return notification;
}

/**
 * Get user's notifications
 */
export async function getUserNotifications(
  userAddress: string,
  options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }
): Promise<{ notifications: NotificationData[]; total: number }> {
  const db = getDatabase();
  const normalizedAddress = userAddress.toLowerCase();
  
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  
  const conditions = [eq(notifications.userAddress, normalizedAddress)];
  if (options?.unreadOnly) {
    conditions.push(eq(notifications.read, false));
  }
  
  const [results, countResult] = await Promise.all([
    db.select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: notifications.id })
      .from(notifications)
      .where(and(...conditions))
  ]);
  
  return {
    notifications: results as NotificationData[],
    total: countResult.length,
  };
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userAddress: string): Promise<number> {
  const db = getDatabase();
  const normalizedAddress = userAddress.toLowerCase();
  
  const results = await db.select()
    .from(notifications)
    .where(and(
      eq(notifications.userAddress, normalizedAddress),
      eq(notifications.read, false)
    ));
  
  return results.length;
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: number, userAddress: string): Promise<void> {
  const db = getDatabase();
  const normalizedAddress = userAddress.toLowerCase();
  
  await db.update(notifications)
    .set({ 
      read: true,
      readAt: new Date(),
    })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userAddress, normalizedAddress)
    ));
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userAddress: string): Promise<void> {
  const db = getDatabase();
  const normalizedAddress = userAddress.toLowerCase();
  
  await db.update(notifications)
    .set({ 
      read: true,
      readAt: new Date(),
    })
    .where(and(
      eq(notifications.userAddress, normalizedAddress),
      eq(notifications.read, false)
    ));
}

/**
 * Get notification preferences for a user
 */
export async function getNotificationPreferences(
  userAddress: string
): Promise<NotificationPreferencesData> {
  const db = getDatabase();
  const normalizedAddress = userAddress.toLowerCase();
  
  const [prefs] = await db.select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userAddress, normalizedAddress))
    .limit(1);
  
  // Return defaults if no preferences exist
  if (!prefs) {
    return {
      userAddress: normalizedAddress,
      fid: null,
      pushEnabled: true,
      inAppEnabled: true,
      emailEnabled: false,
      updatedAt: new Date(),
    };
  }
  
  return prefs;
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  userAddress: string,
  updates: {
    fid?: number;
    pushEnabled?: boolean;
    inAppEnabled?: boolean;
    emailEnabled?: boolean;
  }
): Promise<NotificationPreferencesData> {
  const db = getDatabase();
  const normalizedAddress = userAddress.toLowerCase();
  
  // Try to update existing preferences
  const [existing] = await db.select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userAddress, normalizedAddress))
    .limit(1);
  
  if (existing) {
    const [updated] = await db.update(notificationPreferences)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.userAddress, normalizedAddress))
      .returning();
    
    return updated;
  } else {
    // Create new preferences
    const [created] = await db.insert(notificationPreferences).values({
      userAddress: normalizedAddress,
      fid: updates.fid,
      pushEnabled: updates.pushEnabled ?? true,
      inAppEnabled: updates.inAppEnabled ?? true,
      emailEnabled: updates.emailEnabled ?? false,
      updatedAt: new Date(),
    }).returning();
    
    return created;
  }
}

