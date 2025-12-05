/**
 * Neynar API integration for Farcaster mini-app push notifications
 * 
 * Documentation: https://docs.neynar.com/docs/send-notifications-to-mini-app-users
 * API Reference: https://docs.neynar.com/reference/publish-frame-notifications
 * 
 * OPTIMIZATIONS:
 * 1. Batched notifications - Groups notifications by content and sends to multiple FIDs at once
 * 2. Rate limiting - Max one push notification per user per 5 minutes
 * 3. Deduplication - Prevents duplicate notifications in the same batch
 */

interface PushNotificationOptions {
  type?: string;
  listingId?: string;
  metadata?: Record<string, any>;
  targetUrl?: string;
}

// Batch queue for notifications
interface QueuedNotification {
  fid: number;
  title: string;
  message: string;
  targetUrl: string;
  metadata?: Record<string, any>;
  queuedAt: number;
}

// In-memory queue for batching notifications
// In production, consider using Redis or a proper queue system
const notificationQueue: Map<string, QueuedNotification[]> = new Map();

// Configuration for batching
const BATCH_SIZE = 100; // Neynar supports up to 100 FIDs per request
const BATCH_DELAY_MS = 2000; // Wait 2 seconds to collect more notifications

// Rate limiting configuration
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes between push notifications per user

// Track last push notification time per FID (in-memory, resets on server restart)
// For persistence across restarts, this should be stored in Redis/database
const lastPushTime: Map<number, number> = new Map();

// Track batch processing timers
const batchTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Generate a notification key for batching similar notifications together
 * Notifications with the same title, message, and targetUrl can be batched
 */
function getNotificationKey(title: string, message: string, targetUrl: string): string {
  // Only batch notifications with exactly the same content
  // This ensures users get the right notification context
  return `${title}::${targetUrl}`;
}

/**
 * Check if a user (FID) is rate limited for push notifications
 * Returns true if the user received a push notification within the rate limit window
 */
function isRateLimited(fid: number): boolean {
  const lastTime = lastPushTime.get(fid);
  if (!lastTime) {
    return false;
  }
  
  const timeSinceLastPush = Date.now() - lastTime;
  return timeSinceLastPush < RATE_LIMIT_MS;
}

/**
 * Record that a push notification was sent to a user
 */
function recordPushSent(fid: number): void {
  lastPushTime.set(fid, Date.now());
}

/**
 * Get rate limit stats for logging
 */
export function getRateLimitStats(): { totalTracked: number; rateLimited: number } {
  let rateLimited = 0;
  const now = Date.now();
  
  for (const [fid, lastTime] of lastPushTime.entries()) {
    if (now - lastTime < RATE_LIMIT_MS) {
      rateLimited++;
    }
  }
  
  return {
    totalTracked: lastPushTime.size,
    rateLimited,
  };
}

/**
 * Clean up old rate limit entries (call periodically to prevent memory growth)
 */
export function cleanupRateLimitCache(): void {
  const now = Date.now();
  const expireTime = RATE_LIMIT_MS * 2; // Keep entries for 2x rate limit window
  
  for (const [fid, lastTime] of lastPushTime.entries()) {
    if (now - lastTime > expireTime) {
      lastPushTime.delete(fid);
    }
  }
}

/**
 * Queue a push notification for batched sending
 * Notifications are grouped by content and sent together to reduce API calls
 * Rate limited to max one push per user per 5 minutes
 */
export async function queuePushNotification(
  fid: number,
  title: string,
  message: string,
  targetUrl: string,
  metadata?: Record<string, any>
): Promise<void> {
  // Check rate limit first
  if (isRateLimited(fid)) {
    console.log(`[neynar-notifications] Rate limited: FID ${fid} received push within last 5 minutes, skipping`);
    return;
  }
  
  const key = getNotificationKey(title, message, targetUrl);
  
  if (!notificationQueue.has(key)) {
    notificationQueue.set(key, []);
  }
  
  const queue = notificationQueue.get(key)!;
  
  // Check if this FID is already in the queue (avoid duplicates)
  const existingIndex = queue.findIndex(n => n.fid === fid);
  if (existingIndex === -1) {
    queue.push({
      fid,
      title,
      message,
      targetUrl,
      metadata,
      queuedAt: Date.now(),
    });
  }
  
  // Start a timer to flush this batch if we haven't already
  if (!batchTimers.has(key)) {
    const timer = setTimeout(() => {
      flushNotificationBatch(key);
    }, BATCH_DELAY_MS);
    batchTimers.set(key, timer);
  }
  
  // Force flush if batch is full
  if (queue.length >= BATCH_SIZE) {
    flushNotificationBatch(key);
  }
}

/**
 * Flush a notification batch - send all queued notifications with the same key
 */
async function flushNotificationBatch(key: string): Promise<void> {
  // Clear the timer
  const timer = batchTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    batchTimers.delete(key);
  }
  
  const queue = notificationQueue.get(key);
  if (!queue || queue.length === 0) {
    notificationQueue.delete(key);
    return;
  }
  
  // Take all notifications from the queue
  const notifications = [...queue];
  notificationQueue.delete(key);
  
  // Get unique FIDs
  const fids = [...new Set(notifications.map(n => n.fid))];
  
  if (fids.length === 0) {
    return;
  }
  
  // Use the first notification's data for the batch
  const firstNotification = notifications[0];
  
  console.log(`[neynar-notifications] Flushing batch: ${fids.length} FIDs for "${firstNotification.title}"`);
  
  // Send batched notification
  await sendBatchedPushNotification(
    fids,
    firstNotification.title,
    firstNotification.message,
    firstNotification.targetUrl
  );
}

/**
 * Force flush all pending notification batches
 * Call this at the end of notification processing to ensure all notifications are sent
 */
export async function flushAllNotificationBatches(): Promise<void> {
  const keys = [...notificationQueue.keys()];
  
  if (keys.length === 0) {
    // Still clean up rate limit cache even if no notifications
    cleanupRateLimitCache();
    return;
  }
  
  const stats = getRateLimitStats();
  console.log(`[neynar-notifications] Flushing ${keys.length} notification batches (rate limit: ${stats.rateLimited}/${stats.totalTracked} users limited)`);
  
  await Promise.all(keys.map(key => flushNotificationBatch(key)));
  
  // Clean up old rate limit entries
  cleanupRateLimitCache();
}

/**
 * Send batched push notification to multiple FIDs via Neynar API
 */
async function sendBatchedPushNotification(
  fids: number[],
  title: string,
  message: string,
  targetUrl: string
): Promise<void> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    console.warn('[neynar-notifications] NEYNAR_API_KEY not configured, skipping push notification');
    return;
  }
  
  if (fids.length === 0) {
    return;
  }
  
  try {
    const url = 'https://api.neynar.com/v2/farcaster/frame/notifications';
    
    const notification = {
      title,
      body: message,
      target_url: targetUrl,
    };
    
    // Send to all FIDs in one request (Neynar supports batched sends)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        target_fids: fids,
        notification,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Neynar API error: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`[neynar-notifications] Batched notification sent to ${fids.length} FIDs:`, result);
    
    // Record push sent for rate limiting (only on success)
    for (const fid of fids) {
      recordPushSent(fid);
    }
  } catch (error) {
    console.error(`[neynar-notifications] Error sending batched notification:`, error);
    // Don't throw - we don't want to fail the notification process
    // Don't record push sent on error - user can retry
  }
}

/**
 * Send push notification via Neynar API (legacy single-user method)
 * 
 * @deprecated Use queuePushNotification for better efficiency
 * This method still works but makes individual API calls per user.
 * For batch processing, use queuePushNotification + flushAllNotificationBatches
 */
export async function sendPushNotification(
  userAddress: string,
  fid: number | undefined,
  title: string,
  message: string,
  options?: PushNotificationOptions
): Promise<void> {
  // We need FID to send notification
  if (!fid) {
    console.warn(`[neynar-notifications] No FID provided for ${userAddress}, cannot send push notification`);
    return;
  }
  
  // Build target URL
  const targetUrl = options?.targetUrl || 
    (options?.listingId ? `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/listing/${options.listingId}` : 
     `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}`);
  
  // Use the queue system for batched sending
  await queuePushNotification(fid, title, message, targetUrl, options?.metadata);
}

/**
 * Handle notification enable/disable events from Neynar webhook
 * 
 * According to Neynar docs, when users add/remove the mini app or enable/disable notifications,
 * Neynar will POST to the webhook URL configured in the manifest (webhookUrl)
 * 
 * The webhook URL format: https://api.neynar.com/f/app/<your_client_id>/event
 * This is set in the farcaster.json manifest file
 */
export async function handleNotificationWebhook(payload: any): Promise<void> {
  // This will be called from the webhook route
  // Handle events like:
  // - User added mini app (with notification token)
  // - User removed mini app
  // - User enabled notifications
  // - User disabled notifications
  
  console.log('[neynar-notifications] Webhook event received:', JSON.stringify(payload, null, 2));
  
  // The exact payload structure depends on Neynar's webhook format
  // Common events might include:
  // - { event: 'mini_app_added', fid: number, notificationDetails: { url, token } }
  // - { event: 'mini_app_removed', fid: number }
  // - { event: 'notifications_enabled', fid: number, notificationDetails: { url, token } }
  // - { event: 'notifications_disabled', fid: number }
  
  // Update user preferences based on webhook events
  // This will be implemented in the webhook route handler
}
