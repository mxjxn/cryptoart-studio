import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, analyticsSnapshots, desc, eq, and, gte } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * GET /api/admin/stats
 * Get analytics stats for a given period
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');
    const period = (searchParams.get('period') || 'daily') as Period;
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    const db = getDatabase();
    
    // Get the most recent snapshot for this period type
    const [latestSnapshot] = await db
      .select()
      .from(analyticsSnapshots)
      .where(eq(analyticsSnapshots.periodType, period))
      .orderBy(desc(analyticsSnapshots.snapshotDate))
      .limit(1);
    
    if (!latestSnapshot) {
      // Return empty stats if no snapshots exist
      return NextResponse.json({
        period,
        totalVolumeWei: '0',
        auctionVolumeWei: '0',
        fixedPriceVolumeWei: '0',
        offerVolumeWei: '0',
        platformFeesWei: '0',
        referralFeesWei: '0',
        totalSales: 0,
        auctionSales: 0,
        fixedPriceSales: 0,
        offerSales: 0,
        activeAuctions: 0,
        uniqueBidders: 0,
        snapshotDate: null,
        message: 'No analytics data available yet. Stats are calculated daily.',
      });
    }
    
    return NextResponse.json({
      period,
      ...latestSnapshot,
    });
  } catch (error) {
    console.error('[Admin] Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

