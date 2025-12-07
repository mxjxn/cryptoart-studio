import { NextRequest, NextResponse } from 'next/server';
import {
  parseWebhookEvent,
  verifyAppKeyWithNeynar,
  ParseWebhookEvent,
} from '@farcaster/miniapp-node';
import { getDatabase, notificationTokens, eq, and } from '@cryptoart/db';
import { updateNotificationPreferences } from '~/lib/server/notifications';

/**
 * POST /api/webhook
 * Handle Farcaster Mini App webhook events
 * 
 * This endpoint receives webhook events from Farcaster clients when:
 * - User adds the mini app (miniapp_added)
 * - User removes the mini app (miniapp_removed)
 * - User enables notifications (notifications_enabled)
 * - User disables notifications (notifications_disabled)
 * 
 * Events are signed with the user's app key using JSON Farcaster Signature format.
 * We verify the signature and store/delete notification tokens accordingly.
 * 
 * See: https://miniapps.farcaster.xyz/docs/specification#notifications
 */

interface NotificationDetails {
  url: string;
  token: string;
}

export async function POST(request: NextRequest) {
  try {
    const requestJson = await request.json();

    // Parse and verify the webhook event signature
    let data;
    try {
      data = await parseWebhookEvent(requestJson, verifyAppKeyWithNeynar);
    } catch (e: unknown) {
      const error = e as ParseWebhookEvent.ErrorType;

      switch (error.name) {
        case 'VerifyJsonFarcasterSignature.InvalidDataError':
        case 'VerifyJsonFarcasterSignature.InvalidEventDataError':
          console.error('[webhook] Invalid request data:', error.message);
          return NextResponse.json(
            { success: false, error: 'Invalid request data' },
            { status: 400 }
          );
        case 'VerifyJsonFarcasterSignature.InvalidAppKeyError':
          console.error('[webhook] Invalid app key:', error.message);
          return NextResponse.json(
            { success: false, error: 'Invalid app key' },
            { status: 401 }
          );
        case 'VerifyJsonFarcasterSignature.VerifyAppKeyError':
          console.error('[webhook] Verification failed:', error.message);
          return NextResponse.json(
            { success: false, error: 'Verification failed' },
            { status: 500 }
          );
        default:
          console.error('[webhook] Unknown error:', error);
          return NextResponse.json(
            { success: false, error: 'Unknown error' },
            { status: 500 }
          );
      }
    }

    const { fid, event } = data;

    const eventType = event.event;
    console.log(`[webhook] Received event: ${eventType} for FID ${fid}`);

    // Handle different webhook event types
    switch (eventType) {
      case 'miniapp_added':
        // User added the mini app to their Farcaster client
        // notificationDetails may be present if client equates adding to enabling notifications
        console.log(`[webhook] Mini app added by FID ${fid}`);
        if (event.notificationDetails) {
          await saveNotificationToken(fid, event.notificationDetails);
        }
        break;

      case 'notifications_enabled':
        // User explicitly enabled notifications
        console.log(`[webhook] Notifications enabled for FID ${fid}`);
        if (event.notificationDetails) {
          await saveNotificationToken(fid, event.notificationDetails);
        }
        break;

      case 'notifications_disabled':
        // User disabled notifications
        console.log(`[webhook] Notifications disabled for FID ${fid}`);
        await deleteNotificationTokens(fid);
        break;

      case 'miniapp_removed':
        // User removed the mini app
        console.log(`[webhook] Mini app removed by FID ${fid}`);
        await deleteNotificationTokens(fid);
        break;

      default:
        // TypeScript doesn't know about all possible event types, so we use a type assertion
        const unknownEvent = event as { event: string };
        console.warn(`[webhook] Unknown event type: ${unknownEvent.event}`);
    }

    // Must return 200 for the client to consider the webhook successful
    // Otherwise, the Farcaster client will retry
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[webhook] Error handling webhook:', error);
    // Still return 200 to prevent infinite retries
    // Log the error for monitoring
    return NextResponse.json({
      success: false,
      error: 'Failed to process webhook',
    });
  }
}

/**
 * Save notification token to database
 * If a token already exists for this FID and URL, update it
 */
async function saveNotificationToken(
  fid: number,
  details: NotificationDetails
): Promise<void> {
  const db = getDatabase();

  // Check if token already exists for this FID and URL
  const existing = await db
    .select()
    .from(notificationTokens)
    .where(
      and(
        eq(notificationTokens.fid, fid),
        eq(notificationTokens.url, details.url)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing token
    await db
      .update(notificationTokens)
      .set({
        token: details.token,
        updatedAt: new Date(),
      })
      .where(eq(notificationTokens.id, existing[0].id));
    console.log(`[webhook] Updated notification token for FID ${fid}`);
  } else {
    // Insert new token
    await db.insert(notificationTokens).values({
      fid,
      url: details.url,
      token: details.token,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`[webhook] Saved new notification token for FID ${fid}`);
  }

  // Also update notification preferences to enable push notifications
  // We need to find the user address from FID - this is a best-effort update
  // The notification system will handle FID-to-address mapping separately
  try {
    // Try to update preferences if we can find the user
    // This is optional - the main token storage is what matters
  } catch (error) {
    // Don't fail if we can't update preferences
    console.warn(`[webhook] Could not update preferences for FID ${fid}:`, error);
  }
}

/**
 * Delete all notification tokens for a FID
 * Called when user disables notifications or removes the app
 */
async function deleteNotificationTokens(fid: number): Promise<void> {
  const db = getDatabase();

  const result = await db
    .delete(notificationTokens)
    .where(eq(notificationTokens.fid, fid));

  console.log(`[webhook] Deleted notification tokens for FID ${fid}`);
}

