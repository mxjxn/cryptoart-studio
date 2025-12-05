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

    console.log('[API /auctions/active] Request:', { first, skip, enrich, useCache });

    let enrichedAuctions: EnrichedAuctionData[];
    
    if (useCache) {
      // Use cached data for faster response
      console.log('[API /auctions/active] Using cached data');
      enrichedAuctions = await getCachedActiveAuctions(first, skip, enrich);
    } else {
      // Bypass cache for fresh data (e.g., when client polls for updates)
      console.log('[API /auctions/active] Fetching fresh data');
      enrichedAuctions = await fetchActiveAuctionsUncached(first, skip, enrich);
    }

    console.log('[API /auctions/active] Returning', enrichedAuctions.length, 'auctions');

    return NextResponse.json({
      success: true,
      auctions: enrichedAuctions,
      count: enrichedAuctions.length,
      cached: useCache,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch active auctions';
    console.error('[API /auctions/active] Error:', errorMessage, error);
    
    return NextResponse.json(
      {
        success: false,
        auctions: [],
        count: 0,
        error: errorMessage,
      },
      { status: 200 } // Return 200 so client can handle gracefully
    );
  }
}

