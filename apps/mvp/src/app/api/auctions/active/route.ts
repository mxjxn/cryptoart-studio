import { NextRequest, NextResponse } from 'next/server';
import type { EnrichedAuctionData } from '~/lib/types';
import { getCachedActiveAuctions, fetchActiveAuctionsUncached } from '~/lib/server/auction';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const first = parseInt(searchParams.get('first') || '16'); // Default to 16 for homepage
    const skip = parseInt(searchParams.get('skip') || '0');
    const enrich = searchParams.get('enrich') !== 'false'; // Default to true
    const useCache = searchParams.get('cache') !== 'false'; // Default to true

    let enrichedAuctions: EnrichedAuctionData[];
    
    if (useCache) {
      // Use cached data for faster response
      enrichedAuctions = await getCachedActiveAuctions(first, skip, enrich);
    } else {
      // Bypass cache for fresh data (e.g., when client polls for updates)
      enrichedAuctions = await fetchActiveAuctionsUncached(first, skip, enrich);
    }

    return NextResponse.json({
      success: true,
      auctions: enrichedAuctions,
      count: enrichedAuctions.length,
      cached: useCache,
    });
  } catch (error) {
    console.error('Error fetching active auctions:', error);
    
    return NextResponse.json(
      {
        success: true,
        auctions: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Failed to fetch active auctions',
      },
      { status: 200 }
    );
  }
}

