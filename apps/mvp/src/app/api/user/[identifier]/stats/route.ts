import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, userStats, userCache, eq, sql } from '@cryptoart/db';

/**
 * Resolve identifier to user address
 * Returns primary address
 */
async function resolveUserAddress(identifier: string): Promise<string | null> {
  const db = getDatabase();
  
  // Check if it's an ethereum address
  const isEthAddress = /^0x[a-fA-F0-9]{40}$/i.test(identifier);
  
  if (isEthAddress) {
    return identifier.toLowerCase();
  }
  
  // Otherwise treat as username
  const normalizedUsername = identifier.toLowerCase();
  const [user] = await db
    .select()
    .from(userCache)
    .where(sql`lower(${userCache.username}) = ${normalizedUsername}`)
    .limit(1);
  
  return user ? user.ethAddress.toLowerCase() : null;
}

/**
 * GET /api/user/[identifier]/stats
 * Get cached user statistics
 * Falls back to calculating on-demand if not cached
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params;
    
    if (!identifier) {
      return NextResponse.json(
        { error: 'Username or address is required' },
        { status: 400 }
      );
    }
    
    // Resolve identifier to address
    const primaryAddress = await resolveUserAddress(identifier);
    
    if (!primaryAddress) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const db = getDatabase();
    
    // Try to get cached stats
    const [cachedStats] = await db
      .select()
      .from(userStats)
      .where(eq(userStats.userAddress, primaryAddress.toLowerCase()))
      .limit(1);
    
    if (cachedStats) {
      // Check if stats are stale (older than 24 hours)
      const age = Date.now() - new Date(cachedStats.calculatedAt).getTime();
      const isStale = age > 24 * 60 * 60 * 1000;
      
      return NextResponse.json({
        success: true,
        stats: cachedStats,
        cached: true,
        stale: isStale,
        calculatedAt: cachedStats.calculatedAt,
      }, {
        headers: {
          // Cache for 1 hour, allow stale for 2 hours while revalidating
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      });
    }
    
    // No cached stats - trigger async calculation and return empty stats
    // The cron job will calculate proper stats
    return NextResponse.json({
      success: true,
      stats: {
        userAddress: primaryAddress.toLowerCase(),
        totalArtworksSold: 0,
        totalSalesVolumeWei: '0',
        totalSalesCount: 0,
        uniqueBuyers: 0,
        tokensSoldIn: null,
        totalArtworksPurchased: 0,
        totalPurchaseVolumeWei: '0',
        totalPurchaseCount: 0,
        uniqueSellers: 0,
        tokensBoughtIn: null,
        totalBidsPlaced: 0,
        totalBidsWon: 0,
        totalBidVolumeWei: '0',
        activeBids: 0,
        totalOffersMade: 0,
        totalOffersReceived: 0,
        offersAccepted: 0,
        offersRescinded: 0,
        activeListings: 0,
        totalListingsCreated: 0,
        cancelledListings: 0,
        firstSaleDate: null,
        lastSaleDate: null,
        firstPurchaseDate: null,
        lastPurchaseDate: null,
      },
      cached: false,
      message: 'Stats not yet calculated. They will be available after the next update cycle.',
    }, {
      status: 202, // Accepted - processing will happen async
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[API] Error fetching user stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user stats',
      },
      { status: 500 }
    );
  }
}
