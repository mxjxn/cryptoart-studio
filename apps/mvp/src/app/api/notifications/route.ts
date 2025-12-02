import { NextRequest, NextResponse } from 'next/server';
import { getUserNotifications } from '~/lib/server/notifications.js';

/**
 * GET /api/notifications
 * Fetch user's notifications
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');
    
    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/i.test(userAddress)) {
      return NextResponse.json(
        { error: 'Valid user address is required' },
        { status: 400 }
      );
    }
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    
    const result = await getUserNotifications(userAddress, {
      limit,
      offset,
      unreadOnly,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[notifications API] Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Create a notification (admin/internal use)
 */
export async function POST(req: NextRequest) {
  try {
    // This endpoint is for internal use only
    // In production, add authentication/authorization here
    
    const body = await req.json();
    const { userAddress, type, title, message, fid, listingId, metadata } = body;
    
    if (!userAddress || !type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, type, title, message' },
        { status: 400 }
      );
    }
    
    const { createNotification } = await import('~/lib/server/notifications.js');
    const notification = await createNotification(
      userAddress,
      type,
      title,
      message,
      { fid, listingId, metadata }
    );
    
    return NextResponse.json({ notification });
  } catch (error) {
    console.error('[notifications API] Error creating notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

