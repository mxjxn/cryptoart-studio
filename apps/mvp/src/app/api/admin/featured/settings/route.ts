import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, featuredSettings, eq } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

/**
 * GET /api/admin/featured/settings
 * Get featured settings
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
      .from(featuredSettings)
      .limit(1);
    
    if (!settings) {
      // Return defaults if no settings exist
      return NextResponse.json({
        autoMode: false,
        autoCount: 5,
        lastAutoRefresh: null,
      });
    }
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[Admin] Error fetching featured settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch featured settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/featured/settings
 * Update featured settings
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { autoMode, autoCount, adminAddress } = body;
    
    // Verify admin
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    const db = getDatabase();
    
    // Get existing settings
    const [existing] = await db
      .select()
      .from(featuredSettings)
      .limit(1);
    
    const updates: Record<string, boolean | number | Date> = {
      updatedAt: new Date(),
    };
    
    if (typeof autoMode === 'boolean') {
      updates.autoMode = autoMode;
    }
    
    if (typeof autoCount === 'number' && autoCount > 0) {
      updates.autoCount = autoCount;
    }
    
    if (existing) {
      await db
        .update(featuredSettings)
        .set(updates)
        .where(eq(featuredSettings.id, existing.id));
    } else {
      // Create settings if they don't exist
      await db.insert(featuredSettings).values({
        autoMode: autoMode ?? false,
        autoCount: autoCount ?? 5,
      });
    }
    
    console.log(`[Admin] Featured settings updated by ${adminAddress}:`, updates);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] Error updating featured settings:', error);
    return NextResponse.json(
      { error: 'Failed to update featured settings' },
      { status: 500 }
    );
  }
}

