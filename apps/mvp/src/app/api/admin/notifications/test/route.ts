import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '~/lib/server/admin';
import { sendPushNotification } from '~/lib/server/neynar-notifications';
import { getUserFromCache } from '~/lib/server/user-cache';

/**
 * POST /api/admin/notifications/test
 * Send a test notification to a specific FID
 * Admin only endpoint
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fid, title, body: message, adminAddress } = body;

    // Verify admin
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    // Validate input
    if (!fid || typeof fid !== 'number') {
      return NextResponse.json(
        { error: 'FID is required and must be a number' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string' || title.length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (title.length > 32) {
      return NextResponse.json(
        { error: 'Title must be 32 characters or less' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string' || message.length === 0) {
      return NextResponse.json(
        { error: 'Body is required' },
        { status: 400 }
      );
    }

    if (message.length > 128) {
      return NextResponse.json(
        { error: 'Body must be 128 characters or less' },
        { status: 400 }
      );
    }

    // Try to find user address from FID (optional, for logging)
    let userAddress: string | undefined;
    try {
      // Look up user by FID in database
      // This is best-effort - we can still send notification without address
      const { getDatabase, userCache, eq } = await import('@cryptoart/db');
      const db = getDatabase();
      const users = await db
        .select()
        .from(userCache)
        .where(eq(userCache.fid, fid))
        .limit(1);
      
      if (users && users.length > 0) {
        userAddress = users[0].ethAddress;
      }
    } catch (error) {
      // Ignore lookup errors - we can still send notification
      console.warn(`[test notification] Could not lookup address for FID ${fid}:`, error);
    }

    // Send the notification
    // If using Neynar managed service, this will use their API
    // If self-hosting, we need to look up the token from database
    const neynarEnabled = process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID;
    
    if (neynarEnabled) {
      // Using Neynar managed service - just send via their API
      await sendPushNotification(
        userAddress || `fid:${fid}`, // Use FID as fallback identifier
        fid,
        title,
        message,
        {
          targetUrl: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/notifications`,
        }
      );
      
      // Note: With Neynar, we can't check delivery status from this endpoint
      // If notification_deliveries is empty, it means the user hasn't added the app
      // or hasn't enabled notifications. This is expected for testing.
    } else {
      // Self-hosting - need to look up token from database
      const { getDatabase, notificationTokens, eq } = await import('@cryptoart/db');
      const db = getDatabase();
      
      const tokens = await db
        .select()
        .from(notificationTokens)
        .where(eq(notificationTokens.fid, fid))
        .limit(1);
      
      if (tokens.length === 0) {
        return NextResponse.json(
          { 
            error: `No notification token found for FID ${fid}. User must add the app and enable notifications first.`,
            hint: 'Make sure the user has added the mini app to their Farcaster client and enabled notifications.'
          },
          { status: 404 }
        );
      }
      
      const token = tokens[0];
      
      // Send notification using the stored token
      const targetUrl = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/notifications`;
      const notificationId = `test-${Date.now()}-${fid}`;
      
      const response = await fetch(token.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationId,
          title,
          body: message,
          targetUrl,
          tokens: [token.token],
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send notification: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      
      // Handle invalid tokens
      if (result.invalidTokens && result.invalidTokens.length > 0) {
        // Remove invalid tokens from database
        await db
          .delete(notificationTokens)
          .where(eq(notificationTokens.token, token.token));
        console.log(`[test notification] Removed invalid token for FID ${fid}`);
      }
      
      if (result.successfulTokens && result.successfulTokens.length === 0) {
        return NextResponse.json(
          { 
            error: 'Notification was not sent. Token may be invalid or user has disabled notifications.',
            details: result
          },
          { status: 400 }
        );
      }
    }

    console.log(`[test notification] Sent test notification to FID ${fid} by admin ${adminAddress}`);
    
    // Return success with a note about delivery
    return NextResponse.json({ 
      success: true,
      message: neynarEnabled 
        ? 'Test notification sent to Neynar API. If the user has added the app and enabled notifications, they will receive it.'
        : 'Test notification sent successfully',
      fid,
      note: neynarEnabled 
        ? 'Note: If notification_deliveries is empty in logs, the user may not have added the mini app or enabled notifications yet.'
        : undefined,
    });
  } catch (error) {
    console.error('[test notification] Error sending test notification:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to send test notification',
      },
      { status: 500 }
    );
  }
}

