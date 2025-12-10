import { NextRequest, NextResponse } from 'next/server';
import { 
  getUserNotificationPreferences, 
  updateUserNotificationPreferences 
} from '~/lib/server/notifications';

const NOTIFICATION_KEYS = [
  'newBidOnYourAuction',
  'auctionEnding24h',
  'auctionEnding1h',
  'offerReceived',
  'outbid',
  'auctionWon',
  'purchaseConfirmation',
  'offerAccepted',
  'offerRejected',
] as const;

/**
 * GET /api/user/notification-preferences
 * Get user's granular notification preferences
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
    
    const preferences = await getUserNotificationPreferences(userAddress);
    
    // Return defaults if no preferences exist
    if (!preferences) {
      return NextResponse.json({
        newBidOnYourAuction: true,
        auctionEnding24h: true,
        auctionEnding1h: true,
        offerReceived: true,
        outbid: true,
        auctionWon: true,
        purchaseConfirmation: true,
        offerAccepted: true,
        offerRejected: true,
      });
    }
    
    return NextResponse.json(preferences);
  } catch (error) {
    console.error('[user notification preferences] Error fetching preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/notification-preferences
 * Update user's granular notification preferences
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userAddress, ...updates } = body;
    
    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/i.test(userAddress)) {
      return NextResponse.json(
        { error: 'Valid user address is required' },
        { status: 400 }
      );
    }
    
    // Filter only valid notification keys
    const validUpdates: Record<string, boolean> = {};
    
    for (const key of NOTIFICATION_KEYS) {
      if (typeof updates[key] === 'boolean') {
        validUpdates[key] = updates[key];
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid preference updates provided' },
        { status: 400 }
      );
    }
    
    const preferences = await updateUserNotificationPreferences(userAddress, validUpdates);
    
    return NextResponse.json(preferences);
  } catch (error) {
    console.error('[user notification preferences] Error updating preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}





