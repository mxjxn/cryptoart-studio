import { NextRequest, NextResponse } from 'next/server';
import { updateNotificationPreferences } from '~/lib/server/notifications';

/**
 * POST /api/webhook/neynar
 * Handle Farcaster Mini App webhook events
 *
 * NOTE: When using Neynar's managed service (webhookUrl = https://api.neynar.com/f/app/<client_id>/event),
 * Neynar receives and handles these events internally. This endpoint is only used if you
 * configure a custom webhookUrl pointing to your own server.
 *
 * Farcaster webhook events follow this format:
 * - Event types: miniapp_added, notifications_enabled, notifications_disabled, miniapp_removed
 * - Events are signed with the user's app key using JSON Farcaster Signature format
 *
 * See: https://miniapps.farcaster.xyz/docs/specification
 */

interface NotificationDetails {
  url: string;
  token: string;
}

interface WebhookPayload {
  event: 'miniapp_added' | 'notifications_enabled' | 'notifications_disabled' | 'miniapp_removed';
  notificationDetails?: NotificationDetails;
}

interface ParsedWebhookData {
  fid: number;
  appFid: number;
  payload: WebhookPayload;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log('[neynar webhook] Received webhook event:', JSON.stringify(body, null, 2));

    // The webhook payload can come in two formats:
    // 1. Raw Farcaster signed format: { header, payload, signature } (base64url encoded)
    // 2. Parsed format from Neynar forwarding: { event, fid, notificationDetails, ... }

    let eventData: ParsedWebhookData | null = null;

    // Check if this is the signed format (has header, payload, signature)
    if (body.header && body.payload && body.signature) {
      // This is the raw Farcaster signed format
      // In production, you should verify the signature using @farcaster/miniapp-node
      // For now, we'll just parse the payload
      try {
        const payloadJson = Buffer.from(body.payload, 'base64url').toString('utf-8');
        const headerJson = Buffer.from(body.header, 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadJson) as WebhookPayload;
        const header = JSON.parse(headerJson) as { fid: number; key: string };

        eventData = {
          fid: header.fid,
          appFid: 0, // Would need to extract from signature verification
          payload,
        };
      } catch (parseError) {
        console.error('[neynar webhook] Error parsing signed payload:', parseError);
      }
    } else if (body.event) {
      // This is already parsed (e.g., from Neynar forwarding)
      eventData = {
        fid: body.fid || 0,
        appFid: body.appFid || 0,
        payload: {
          event: body.event,
          notificationDetails: body.notificationDetails,
        },
      };
    }

    if (!eventData) {
      console.warn('[neynar webhook] Could not parse webhook payload');
      return NextResponse.json({ success: true, message: 'Unrecognized format' });
    }

    const { fid, payload } = eventData;

    // Handle different webhook event types based on Farcaster spec
    switch (payload.event) {
      case 'miniapp_added':
        // User added the mini app to their Farcaster client
        // notificationDetails may be present if client equates adding to enabling notifications
        console.log(`[neynar webhook] Mini app added by FID ${fid}`);
        if (payload.notificationDetails && fid) {
          // User has notifications enabled
          // Note: We don't have userAddress here, so we can't update preferences by address
          // The FID-to-address mapping should be handled separately
          console.log(`[neynar webhook] FID ${fid} enabled notifications on add`);
        }
        break;

      case 'notifications_enabled':
        // User explicitly enabled notifications
        console.log(`[neynar webhook] Notifications enabled for FID ${fid}`);
        if (payload.notificationDetails && fid) {
          // Store/update notification token if needed
          // With Neynar's managed service, they handle token storage
          console.log(`[neynar webhook] Token received for FID ${fid}`);
        }
        break;

      case 'notifications_disabled':
        // User disabled notifications
        console.log(`[neynar webhook] Notifications disabled for FID ${fid}`);
        // Any stored tokens for this fid should be invalidated
        break;

      case 'miniapp_removed':
        // User removed the mini app
        console.log(`[neynar webhook] Mini app removed by FID ${fid}`);
        // All tokens for this fid should be invalidated
        break;

      default:
        console.log('[neynar webhook] Unknown event type:', payload.event);
    }

    // Must return 200 for the client to consider the webhook successful
    // Otherwise, the Farcaster client will retry
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[neynar webhook] Error handling webhook:', error);
    // Still return 200 to prevent infinite retries
    // Log the error for monitoring
    return NextResponse.json({
      success: false,
      error: 'Failed to process webhook',
    });
  }
}

