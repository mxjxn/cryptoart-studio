import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, featuredListings, eq, and } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';
import { BASE_CHAIN_ID } from '~/lib/server/subgraph-endpoints';

/**
 * DELETE /api/admin/featured/[listingId]
 * Remove a listing from featured
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');
    
    // Verify admin
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    const chainIdRaw = searchParams.get('chainId');
    const chainId =
      chainIdRaw != null && chainIdRaw !== ''
        ? parseInt(chainIdRaw, 10)
        : BASE_CHAIN_ID;
    if (!Number.isFinite(chainId)) {
      return NextResponse.json({ error: 'Invalid chainId' }, { status: 400 });
    }

    const db = getDatabase();
    
    await db
      .delete(featuredListings)
      .where(
        and(eq(featuredListings.listingId, listingId), eq(featuredListings.chainId, chainId))
      );
    
    console.log(`[Admin] Featured listing removed: ${listingId} by ${adminAddress}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] Error removing featured listing:', error);
    return NextResponse.json(
      { error: 'Failed to remove featured listing' },
      { status: 500 }
    );
  }
}

