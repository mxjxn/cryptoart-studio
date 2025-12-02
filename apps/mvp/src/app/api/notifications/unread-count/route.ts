import { NextRequest, NextResponse } from 'next/server';
import { getUnreadCount } from '~/lib/server/notifications.js';

/**
 * GET /api/notifications/unread-count
 * Get user's unread notification count
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
    
    const count = await getUnreadCount(userAddress);
    
    return NextResponse.json({ count });
  } catch (error) {
    console.error('[notifications API] Error fetching unread count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unread count' },
      { status: 500 }
    );
  }
}

