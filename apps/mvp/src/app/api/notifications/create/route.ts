import { NextRequest, NextResponse } from 'next/server';
import { createNotification } from '~/lib/server/notifications';

/**
 * POST /api/notifications/create
 * Create a notification (for real-time triggers)
 * This endpoint is used by client-side code after successful transactions
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userAddress, type, title, message, fid, listingId, metadata } = body;
    
    if (!userAddress || !type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, type, title, message' },
        { status: 400 }
      );
    }
    
    // Validate userAddress format
    if (!/^0x[a-fA-F0-9]{40}$/i.test(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid user address format' },
        { status: 400 }
      );
    }
    
    const notification = await createNotification(
      userAddress,
      type,
      title,
      message,
      { fid, listingId, metadata, sendPush: true }
    );
    
    return NextResponse.json({ notification });
  } catch (error) {
    console.error('[notifications/create API] Error creating notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

