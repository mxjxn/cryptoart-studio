import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, globalNotificationSettings, eq } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

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
 * GET /api/admin/notifications/settings
 * Get global notification settings
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
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
    console.error('[Admin] Error fetching notification settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/notifications/settings
 * Update global notification settings
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminAddress, ...updates } = body;
    
    // Verify admin
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    const db = getDatabase();
    
    // Filter only valid notification keys
    const validUpdates: Record<string, boolean | Date> = {
      updatedAt: new Date(),
    };
    
    for (const key of NOTIFICATION_KEYS) {
      if (typeof updates[key] === 'boolean') {
        validUpdates[key] = updates[key];
      }
    }
    
    // Get existing settings
    const [existing] = await db
      .select()
      .from(globalNotificationSettings)
      .limit(1);
    
    if (existing) {
      await db
        .update(globalNotificationSettings)
        .set(validUpdates)
        .where(eq(globalNotificationSettings.id, existing.id));
    } else {
      // Create settings if they don't exist
      await db.insert(globalNotificationSettings).values({
        newBidOnYourAuction: updates.newBidOnYourAuction ?? true,
        auctionEnding24h: updates.auctionEnding24h ?? true,
        auctionEnding1h: updates.auctionEnding1h ?? true,
        offerReceived: updates.offerReceived ?? true,
        outbid: updates.outbid ?? true,
        auctionWon: updates.auctionWon ?? true,
        purchaseConfirmation: updates.purchaseConfirmation ?? true,
        offerAccepted: updates.offerAccepted ?? true,
        offerRejected: updates.offerRejected ?? true,
      });
    }
    
    console.log(`[Admin] Notification settings updated by ${adminAddress}:`, validUpdates);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] Error updating notification settings:', error);
    return NextResponse.json(
      { error: 'Failed to update notification settings' },
      { status: 500 }
    );
  }
}

