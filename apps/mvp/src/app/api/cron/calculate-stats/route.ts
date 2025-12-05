import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, analyticsSnapshots } from '@cryptoart/db';
import { getCachedActiveAuctions } from '~/lib/server/auction';
import { request, gql } from 'graphql-request';

const getSubgraphEndpoint = (): string => {
  return process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL || '';
};

const COMPLETED_LISTINGS_QUERY = gql`
  query CompletedListings($startTimestamp: BigInt!) {
    listings(
      where: { finalized: true, updatedAt_gte: $startTimestamp }
      first: 1000
      orderBy: updatedAt
      orderDirection: desc
    ) {
      id
      listingId
      listingType
      totalSold
      finalized
      updatedAt
      bids(orderBy: amount, orderDirection: desc, first: 1) {
        amount
        bidder
      }
    }
  }
`;

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

function getStartDateForPeriod(period: Period, now: Date): Date {
  const start = new Date(now);
  switch (period) {
    case 'daily':
      start.setDate(start.getDate() - 1);
      break;
    case 'weekly':
      start.setDate(start.getDate() - 7);
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'yearly':
      start.setFullYear(start.getFullYear() - 1);
      break;
  }
  return start;
}

async function calculateStatsFromSubgraph(startDate: Date, endDate: Date): Promise<{
  totalVolumeWei: string;
  auctionVolumeWei: string;
  fixedPriceVolumeWei: string;
  offerVolumeWei: string;
  platformFeesWei: string;
  referralFeesWei: string;
  totalSales: number;
  auctionSales: number;
  fixedPriceSales: number;
  offerSales: number;
  activeAuctions: number;
  uniqueBidders: number;
}> {
  try {
    const endpoint = getSubgraphEndpoint();
    if (!endpoint) {
      throw new Error('Subgraph endpoint not configured');
    }
    
    const startTimestamp = Math.floor(startDate.getTime() / 1000).toString();
    
    // Fetch completed listings in the period
    const data = await request<{ listings: any[] }>(
      endpoint,
      COMPLETED_LISTINGS_QUERY,
      { startTimestamp }
    );
    
    // Calculate stats
    let totalVolumeWei = BigInt(0);
    let auctionVolumeWei = BigInt(0);
    let fixedPriceVolumeWei = BigInt(0);
    let offerVolumeWei = BigInt(0);
    let auctionSales = 0;
    let fixedPriceSales = 0;
    let offerSales = 0;
    const uniqueBiddersSet = new Set<string>();
    
    for (const listing of data.listings || []) {
      const highestBidAmount = listing.bids?.[0]?.amount || '0';
      const volumeWei = BigInt(highestBidAmount);
      
      totalVolumeWei += volumeWei;
      
      if (listing.listingType === 'INDIVIDUAL_AUCTION') {
        auctionVolumeWei += volumeWei;
        auctionSales++;
        if (listing.bids?.[0]?.bidder) {
          uniqueBiddersSet.add(listing.bids[0].bidder.toLowerCase());
        }
      } else if (listing.listingType === 'FIXED_PRICE') {
        fixedPriceVolumeWei += volumeWei;
        fixedPriceSales++;
      } else if (listing.listingType === 'OFFERS_ONLY') {
        offerVolumeWei += volumeWei;
        offerSales++;
      }
    }
    
    const totalSales = auctionSales + fixedPriceSales + offerSales;
    
    // Calculate platform fees (2.5% of volume)
    const platformFeesWei = (totalVolumeWei * BigInt(25)) / BigInt(1000);
    
    // Get active auctions count
    const activeListings = await getCachedActiveAuctions(1000, 0, false);
    const activeAuctions = activeListings.filter(l => l.listingType === 'INDIVIDUAL_AUCTION').length;
    
    return {
      totalVolumeWei: totalVolumeWei.toString(),
      auctionVolumeWei: auctionVolumeWei.toString(),
      fixedPriceVolumeWei: fixedPriceVolumeWei.toString(),
      offerVolumeWei: offerVolumeWei.toString(),
      platformFeesWei: platformFeesWei.toString(),
      referralFeesWei: '0', // TODO: Calculate from referral data
      totalSales,
      auctionSales,
      fixedPriceSales,
      offerSales,
      activeAuctions,
      uniqueBidders: uniqueBiddersSet.size,
    };
  } catch (error) {
    console.error('[Stats] Error calculating stats:', error);
    // Return zeros on error
    return {
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
    };
  }
}

/**
 * GET /api/cron/calculate-stats
 * Calculate analytics snapshots for all periods
 * Called by Vercel cron daily at midnight UTC
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = getDatabase();
    const now = new Date();
    
    // Calculate stats for each period
    const periods: Period[] = ['daily', 'weekly', 'monthly', 'yearly'];
    const results: Record<string, any> = {};
    
    for (const period of periods) {
      const startDate = getStartDateForPeriod(period, now);
      const stats = await calculateStatsFromSubgraph(startDate, now);
      
      await db.insert(analyticsSnapshots).values({
        snapshotDate: now,
        periodType: period,
        ...stats,
      });
      
      results[period] = stats;
    }
    
    console.log(`[Cron] Analytics snapshots calculated for all periods`);
    
    return NextResponse.json({ 
      message: 'Stats calculated',
      timestamp: now.toISOString(),
      results,
    });
  } catch (error) {
    console.error('[Cron] Error calculating stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate stats' },
      { status: 500 }
    );
  }
}

