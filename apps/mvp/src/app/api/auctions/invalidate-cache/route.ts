import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

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

    // Revalidate the homepage path and API routes
    revalidatePath('/');
    // Revalidate the browse listings API route to clear HTTP cache
    revalidatePath('/api/listings/browse');
    
    // If listingId is provided, revalidate the specific listing page and API endpoint
    if (listingId) {
      revalidatePath(`/listing/${listingId}`);
      // Also revalidate the API endpoint for this specific listing
      revalidatePath(`/api/auctions/${listingId}`);
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


