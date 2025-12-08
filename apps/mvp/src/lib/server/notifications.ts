import { 
  getDatabase, 
  notifications, 
  notificationPreferences,
  globalNotificationSettings,
  userNotificationPreferences,
  type NotificationData,
  type NotificationPreferencesData,
  type NotificationType,
  type GlobalNotificationSettingsData,
  type UserNotificationPreferencesData,
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
 * Map NotificationType to user preference key
 * Returns null if the notification type doesn't have a user preference toggle
 */
function mapNotificationTypeToPreferenceKey(type: NotificationType): string | null {
  const mapping: Record<NotificationType, string | null> = {
    'LISTING_CREATED': null,
    'NEW_BID': 'newBidOnYourAuction',
    'AUCTION_WON': 'auctionWon',
    'AUCTION_ENDED_NO_BIDS': null,
    'BUY_NOW_SALE': null,
    'NEW_OFFER': 'offerReceived',
    'BID_PLACED': null,
    'OUTBID': 'outbid',
    'ERC1155_PURCHASE': 'purchaseConfirmation',
    'ERC721_PURCHASE': 'purchaseConfirmation',
    'OFFER_ACCEPTED': 'offerAccepted',
    'OFFER_RESCINDED': 'offerRejected',
    'LISTING_CANCELLED': null,
    'LISTING_MODIFIED': null,
    'FOLLOWED_USER_NEW_LISTING': null,
    'FAVORITE_NEW_BID': null,
    'FAVORITE_LOW_STOCK': null,
    'FAVORITE_ENDING_SOON': null,
  };
  return mapping[type] ?? null;
}

/**
 * Get global notification settings
 */
export async function getGlobalNotificationSettings(): Promise<GlobalNotificationSettingsData | null> {
  const db = getDatabase();
  const [settings] = await db
    .select()
    .from(globalNotificationSettings)
    .limit(1);
  return settings || null;
}

/**
 * Get user's granular notification preferences
 */
export async function getUserNotificationPreferences(
  userAddress: string
): Promise<UserNotificationPreferencesData | null> {
  const db = getDatabase();
  const normalizedAddress = userAddress.toLowerCase();
  
  const [prefs] = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userAddress, normalizedAddress))
    .limit(1);
  
  return prefs || null;
}

/**
 * Update user's granular notification preferences
 */
export async function updateUserNotificationPreferences(
  userAddress: string,
  updates: Partial<Omit<UserNotificationPreferencesData, 'id' | 'userAddress' | 'createdAt' | 'updatedAt'>>
): Promise<UserNotificationPreferencesData> {
  const db = getDatabase();
  const normalizedAddress = userAddress.toLowerCase();
  
  const [existing] = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userAddress, normalizedAddress))
    .limit(1);
  
  if (existing) {
    const [updated] = await db
      .update(userNotificationPreferences)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(userNotificationPreferences.userAddress, normalizedAddress))
      .returning();
    
    return updated;
  } else {
    // Create new preferences with defaults
    const [created] = await db
      .insert(userNotificationPreferences)
      .values({
        userAddress: normalizedAddress,
        newBidOnYourAuction: updates.newBidOnYourAuction ?? true,
        auctionEnding24h: updates.auctionEnding24h ?? true,
        auctionEnding1h: updates.auctionEnding1h ?? true,
        offerReceived: updates.offerReceived ?? true,
        outbid: updates.outbid ?? true,
        auctionWon: updates.auctionWon ?? true,
        purchaseConfirmation: updates.purchaseConfirmation ?? true,
        offerAccepted: updates.offerAccepted ?? true,
        offerRejected: updates.offerRejected ?? true,
      })
      .returning();
    
    return created;
  }
}

/**
 * Check if a notification type should be sent based on global and user preferences
 */
export async function shouldSendNotificationType(
  userAddress: string,
  type: NotificationType
): Promise<boolean> {
  const preferenceKey = mapNotificationTypeToPreferenceKey(type);
  
  // If this notification type doesn't have a preference toggle, always send (if globally enabled)
  if (!preferenceKey) {
    const globalSettings = await getGlobalNotificationSettings();
    // If no global settings exist, default to enabled
    if (!globalSettings) return true;
    // For types without user preferences, we still respect global settings
    // But since there's no specific global setting for these types, we default to true
    return true;
  }
  
  // Check global settings first (highest priority)
  const globalSettings = await getGlobalNotificationSettings();
  if (globalSettings) {
    const globalValue = globalSettings[preferenceKey as keyof GlobalNotificationSettingsData] as boolean | undefined;
    if (globalValue === false) {
      // Globally disabled, don't send
      return false;
    }
  }
  
  // Check user preferences
  const userPrefs = await getUserNotificationPreferences(userAddress);
  if (userPrefs) {
    const userValue = userPrefs[preferenceKey as keyof UserNotificationPreferencesData] as boolean | undefined;
    if (userValue === false) {
      // User has disabled this notification type
      return false;
    }
  }
  
  // Default to enabled if no preferences exist
  return true;
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
  
  // Check if this notification type should be sent based on preferences
  const shouldSend = await shouldSendNotificationType(userAddress, type);
  if (!shouldSend) {
    // Don't create notification if user or admin has disabled this type
    // Return a minimal notification object to satisfy the return type
    // This won't be saved to the database, but allows callers to continue
    return {
      id: 0,
      userAddress: userAddress.toLowerCase(),
      fid: options?.fid || null,
      type,
      listingId: options?.listingId || null,
      title,
      message,
      metadata: options?.metadata || null,
      read: true, // Mark as read since it won't be shown
      pushed: false,
      createdAt: new Date(),
      readAt: new Date(),
    } as NotificationData;
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

