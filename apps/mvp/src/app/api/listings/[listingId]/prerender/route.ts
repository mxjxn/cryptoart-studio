import { NextRequest, NextResponse } from 'next/server';
import { prerenderListingOGImage } from '~/lib/server/og-image-prerender';
import { prerenderListingCardData } from '~/lib/server/listing-card-prerender';

/**
 * POST /api/listings/[listingId]/prerender
 * Pre-render OG image and listing card data for a listing
 * 
 * This endpoint can be called:
 * - When a new listing is created (from webhook/cron)
 * - Manually to refresh pre-rendered data
 * - From batch jobs to pre-render existing listings
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;
    
    if (!listingId) {
      return NextResponse.json(
        { success: false, error: 'Listing ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`[Prerender API] Starting pre-render for listing ${listingId}...`);
    
    // Get base URL for OG image pre-rendering
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Pre-render both OG image and listing card data in parallel
    const [ogResult, cardResult] = await Promise.allSettled([
      prerenderListingOGImage(listingId, baseUrl),
      prerenderListingCardData(listingId),
    ]);
    
    const results: Record<string, any> = {
      listingId,
      ogImage: ogResult.status === 'fulfilled' ? 'success' : 'failed',
      listingCard: cardResult.status === 'fulfilled' && cardResult.value ? 'success' : 'failed',
    };
    
    if (ogResult.status === 'rejected') {
      results.ogImageError = ogResult.reason instanceof Error ? ogResult.reason.message : String(ogResult.reason);
    }
    
    if (cardResult.status === 'rejected') {
      results.cardError = cardResult.reason instanceof Error ? cardResult.reason.message : String(cardResult.reason);
    }
    
    console.log(`[Prerender API] Completed pre-render for listing ${listingId}:`, results);
    
    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('[Prerender API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
