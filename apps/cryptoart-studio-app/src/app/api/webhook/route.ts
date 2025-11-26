import type { ParseWebhookEvent } from "@farcaster/miniapp-node";
import { NextRequest } from "next/server";

// Force dynamic rendering to avoid build-time execution issues
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  // Lazy load all modules to avoid build-time execution issues
  const [
    { parseWebhookEvent, verifyAppKeyWithNeynar },
    { APP_NAME },
    { sendMiniAppNotification },
    { hypersubCache }
  ] = await Promise.all([
    import("@farcaster/miniapp-node"),
    import("~/lib/constants"),
    import("~/lib/notifs"),
    import('@cryptoart/cache')
  ]);

  // If Neynar is enabled, we don't need to handle webhooks here
  // as they will be handled by Neynar's webhook endpoint
  const neynarEnabled = process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID;
  if (neynarEnabled) {
    return Response.json({ success: true });
  }

  const requestJson = await request.json();

  let data;
  try {
    data = await parseWebhookEvent(requestJson, verifyAppKeyWithNeynar);
  } catch (e: unknown) {
    const error = e as ParseWebhookEvent.ErrorType;

    switch (error.name) {
      case "VerifyJsonFarcasterSignature.InvalidDataError":
      case "VerifyJsonFarcasterSignature.InvalidEventDataError":
        // The request data is invalid
        return Response.json(
          { success: false, error: error.message },
          { status: 400 }
        );
      case "VerifyJsonFarcasterSignature.InvalidAppKeyError":
        // The app key is invalid
        return Response.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      case "VerifyJsonFarcasterSignature.VerifyAppKeyError":
        // Internal error verifying the app key (caller may want to try again)
        return Response.json(
          { success: false, error: error.message },
          { status: 500 }
        );
    }
  }

  const fid = data.fid;
  const event = data.event;

  // Only handle notifications if Neynar is not enabled
  // When Neynar is enabled, notifications are handled through their webhook
  switch (event.event) {
    case "miniapp_added":
      if (event.notificationDetails) {
        // Pass notification details directly - no need to store them
        await sendMiniAppNotification({
          fid,
          title: `Welcome to ${APP_NAME}`,
          body: "Mini app is now added to your client",
          notificationDetails: event.notificationDetails,
        });
      }
      break;

    case "miniapp_removed":
      // No action needed - just log the removal
      break;

    case "notifications_enabled":
      // Pass notification details directly - no need to store them
      await sendMiniAppNotification({
        fid,
        title: `Welcome to ${APP_NAME}`,
        body: "Notifications are now enabled",
        notificationDetails: event.notificationDetails,
      });
      break;

    case "notifications_disabled":
      // No action needed - just log the disable
      break;
  }

  // Cache invalidation for Hypersub data
  // Note: In a real implementation, you'd want to listen for specific
  // Neynar webhook events related to subscription changes
  try {
    console.log(`Invalidating cache for FID ${fid} due to webhook event: ${event.event}`);
    
    // Invalidate subscription cache
    await hypersubCache.invalidateSubscriptions(fid);
    
    // Invalidate all subscriber cache entries for this user
    await hypersubCache.invalidateSubscribers(fid);
    
    console.log(`Cache invalidated successfully for FID ${fid}`);
  } catch (cacheError) {
    console.error('Failed to invalidate cache:', cacheError);
    // Don't fail the webhook if cache invalidation fails
  }

  return Response.json({ success: true });
}
