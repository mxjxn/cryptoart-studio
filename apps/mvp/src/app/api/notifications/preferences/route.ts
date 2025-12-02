import { NextRequest, NextResponse } from 'next/server';
import { 
  getNotificationPreferences, 
  updateNotificationPreferences 
} from '~/lib/server/notifications.js';

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
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
    
    const preferences = await getNotificationPreferences(userAddress);
    
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('[notifications API] Error fetching preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/preferences
 * Update user's notification preferences
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userAddress, fid, pushEnabled, inAppEnabled, emailEnabled } = body;
    
    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/i.test(userAddress)) {
      return NextResponse.json(
        { error: 'Valid user address is required' },
        { status: 400 }
      );
    }
    
    const preferences = await updateNotificationPreferences(userAddress, {
      fid,
      pushEnabled,
      inAppEnabled,
      emailEnabled,
    });
    
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('[notifications API] Error updating preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}

