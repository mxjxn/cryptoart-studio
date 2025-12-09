import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, globalNotificationSettings } from '@cryptoart/db';

/**
 * GET /api/notifications/global-settings
 * Get global notification settings (public endpoint for users to check what's enabled)
 */
export async function GET(req: NextRequest) {
  try {
    const db = getDatabase();
    
    const [settings] = await db
      .select()
      .from(globalNotificationSettings)
      .limit(1);
    
    if (!settings) {
      // Return defaults if no settings exist
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
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[notifications] Error fetching global settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch global notification settings' },
      { status: 500 }
    );
  }
}



