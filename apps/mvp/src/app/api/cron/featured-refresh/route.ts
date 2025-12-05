import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, featuredListings, featuredSettings, eq } from '@cryptoart/db';
import { getCachedActiveAuctions } from '~/lib/server/auction';

/**
 * GET /api/cron/featured-refresh
 * Auto-refresh featured listings (when auto mode is enabled)
 * Called by Vercel cron every hour
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = getDatabase();
    
    // Get settings
    const [settings] = await db.select().from(featuredSettings).limit(1);
    
    if (!settings?.autoMode) {
      return NextResponse.json({ message: 'Auto mode disabled', skipped: true });
    }
    
    // Check if 24 hours have passed since last refresh
    const now = new Date();
    const lastRefresh = settings.lastAutoRefresh;
    const hoursSinceRefresh = lastRefresh 
      ? (now.getTime() - lastRefresh.getTime()) / (1000 * 60 * 60) 
      : 999;
    
    if (hoursSinceRefresh < 24) {
      return NextResponse.json({ 
        message: 'Not yet time to refresh', 
        hoursSinceRefresh: hoursSinceRefresh.toFixed(1),
        skipped: true 
      });
    }
    
    // Fetch active listings from subgraph
    const activeListings = await getCachedActiveAuctions(100, 0, false);
    
    if (activeListings.length === 0) {
      return NextResponse.json({ message: 'No active listings available', skipped: true });
    }
    
    // Shuffle and select random listings
    const shuffled = [...activeListings].sort(() => Math.random() - 0.5);
    const randomListings = shuffled.slice(0, settings.autoCount);
    
    // Clear and replace featured listings in a transaction to prevent race conditions
    await db.transaction(async (tx) => {
      // Delete all existing featured listings
      await tx.delete(featuredListings);
      
      // Insert new featured listings
      for (let i = 0; i < randomListings.length; i++) {
        await tx.insert(featuredListings).values({
          listingId: randomListings[i].listingId,
          displayOrder: i,
        });
      }
      
      // Update last refresh time
      await tx
        .update(featuredSettings)
        .set({ lastAutoRefresh: now, updatedAt: now })
        .where(eq(featuredSettings.id, settings.id));
    });
    
    console.log(`[Cron] Featured listings refreshed with ${randomListings.length} listings`);
    
    return NextResponse.json({ 
      message: 'Featured listings refreshed',
      count: randomListings.length,
      listingIds: randomListings.map(l => l.listingId),
    });
  } catch (error) {
    console.error('[Cron] Error refreshing featured listings:', error);
    return NextResponse.json(
      { error: 'Failed to refresh featured listings' },
      { status: 500 }
    );
  }
}

