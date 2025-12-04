import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';

/**
 * Invalidate auctions cache after listing changes
 * Called after creating, canceling, or finalizing listings
 */
export async function POST(req: NextRequest) {
  try {
    // Revalidate the auctions cache tag
    revalidateTag('auctions');
    // Also revalidate the homepage path
    revalidatePath('/');
    
    return NextResponse.json({
      success: true,
      message: 'Cache invalidated',
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


