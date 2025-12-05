import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';

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

    // Revalidate the auctions cache tag
    revalidateTag('auctions');
    // Also revalidate the homepage path
    revalidatePath('/');
    
    // If listingId is provided, revalidate the specific listing page
    if (listingId) {
      revalidatePath(`/listing/${listingId}`);
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


