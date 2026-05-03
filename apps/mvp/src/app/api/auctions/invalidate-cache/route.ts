import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAuctionServer } from '~/lib/server/auction';
import { requestListingMetadataRefresh } from '~/lib/server/listing-metadata-refresh';

/**
 * Invalidate auctions cache after listing changes
 * Called after creating, canceling, or finalizing listings
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body to get optional listingId
    let listingId: string | undefined;
    try {
      const body = await req.json();
      listingId = body.listingId;
    } catch {
      // Body is optional, continue without it
    }

    // Revalidate the homepage path
    revalidatePath('/');
    // Revalidate the browse listings API route to clear HTTP cache
    revalidatePath('/api/listings/browse');
    
    // If listingId is provided, revalidate the specific listing page and API endpoint
    // revalidatePath also invalidates unstable_cache for that route
    if (listingId) {
      revalidatePath(`/listing/${listingId}`);
      // Revalidate the API endpoint - this clears both HTTP cache and unstable_cache
      revalidatePath(`/api/auctions/${listingId}`);

      // Opportunistically queue metadata refresh for the changed listing.
      // Cooldown policy prevents repeated expensive refreshes.
      try {
        const listing = await getAuctionServer(listingId);
        if (listing?.tokenAddress && listing?.tokenId) {
          await requestListingMetadataRefresh({
            listingId,
            tokenAddress: listing.tokenAddress,
            tokenId: listing.tokenId,
            tokenSpec: listing.tokenSpec,
          });
        }
      } catch (error) {
        console.warn('[invalidate-cache] metadata refresh queue failed:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Cache invalidated',
      listingId: listingId || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error invalidating cache:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


