/**
 * Neynar API integration for Farcaster mini-app push notifications
 * 
 * Documentation: https://docs.neynar.com/docs/send-notifications-to-mini-app-users
 * API Reference: https://docs.neynar.com/reference/publish-frame-notifications
 */

interface PushNotificationOptions {
  type?: string;
  listingId?: string;
  metadata?: Record<string, any>;
  targetUrl?: string;
}

interface NotificationFilters {
  exclude_fids?: number[];
  following_fid?: number;
  minimum_user_score?: number;
  near_location?: {
    latitude: number;
    longitude: number;
    radius?: number; // in meters, defaults to 50000 (50km)
  };
}

/**
 * Send push notification via Neynar API
 * 
 * According to Neynar docs, notifications are sent using publishFrameNotifications API
 * which accepts targetFids (array), filters (optional), and notification object
 */
export async function sendPushNotification(
  userAddress: string,
  fid: number | undefined,
  title: string,
  message: string,
  options?: PushNotificationOptions
): Promise<void> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    console.warn('[neynar-notifications] NEYNAR_API_KEY not configured, skipping push notification');
    return;
  }
  
  // We need FID to send notification
  if (!fid) {
    console.warn(`[neynar-notifications] No FID provided for ${userAddress}, cannot send push notification`);
    return;
  }
  
  try {
    // Neynar API endpoint for publishing frame notifications
    // Based on documentation: https://docs.neynar.com/reference/publish-frame-notifications
    // Note: The exact REST endpoint may need verification. The docs show using @neynar/nodejs-sdk
    // with client.publishFrameNotifications(), but the REST endpoint should be similar.
    // If this doesn't work, check the Neynar API reference or use the SDK instead.
    const url = 'https://api.neynar.com/v2/farcaster/frame/notifications';
    
    // Build target URL - use listing page if listingId provided, otherwise use home
    const targetUrl = options?.targetUrl || 
      (options?.listingId ? `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/listing/${options.listingId}` : 
       `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}`);
    
    // According to docs, notification object should have: title, body, target_url
    const notification = {
      title,
      body: message,
      target_url: targetUrl,
    };
    
    // Target specific FID(s) - pass empty array to target all users with notifications enabled
    const targetFids = [fid];
    
    // Optional filters - can be used to exclude certain users, filter by following, etc.
    const filters: NotificationFilters = {};
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey, // Consistent with other Neynar API calls in codebase
      },
      body: JSON.stringify({
        target_fids: targetFids,
        filters,
        notification,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Neynar API error: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`[neynar-notifications] Push notification sent to FID ${fid}:`, result);
  } catch (error) {
    console.error(`[neynar-notifications] Error sending push notification:`, error);
    throw error;
  }
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

