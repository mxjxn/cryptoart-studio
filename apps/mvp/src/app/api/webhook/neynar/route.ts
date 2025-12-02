import { NextRequest, NextResponse } from 'next/server';
import { handleNotificationWebhook } from '~/lib/server/neynar-notifications.js';
import { updateNotificationPreferences } from '~/lib/server/notifications.js';

/**
 * POST /api/webhook/neynar
 * Handle Neynar webhook events (notification enable/disable)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Verify webhook signature if Neynar provides one
    // TODO: Add signature verification when Neynar webhook format is known
    
    // Handle different webhook event types
    const { event, data } = body;
    
    switch (event) {
      case 'notification.enabled':
        // User enabled notifications
        if (data?.userAddress && data?.fid) {
          await updateNotificationPreferences(data.userAddress, {
            fid: data.fid,
            pushEnabled: true,
          });
        }
        break;
        
      case 'notification.disabled':
        // User disabled notifications
        if (data?.userAddress) {
          await updateNotificationPreferences(data.userAddress, {
            pushEnabled: false,
          });
        }
        break;
        
      default:
        console.log('[neynar webhook] Unknown event type:', event);
    }
    
    // Also call the handler function
    await handleNotificationWebhook(body);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[neynar webhook] Error handling webhook:', error);
    return NextResponse.json(
      { error: 'Failed to handle webhook' },
      { status: 500 }
    );
  }
}

