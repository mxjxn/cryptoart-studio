import { NextRequest, NextResponse } from 'next/server';
import { markAsRead } from '~/lib/server/notifications';

/**
 * POST /api/notifications/[id]/read
 * Mark a notification as read
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const notificationId = parseInt(id);
    
    if (isNaN(notificationId)) {
      return NextResponse.json(
        { error: 'Invalid notification ID' },
        { status: 400 }
      );
    }
    
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');
    
    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/i.test(userAddress)) {
      return NextResponse.json(
        { error: 'Valid user address is required' },
        { status: 400 }
      );
    }
    
    await markAsRead(notificationId, userAddress);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[notifications API] Error marking notification as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}

