import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, featuredListings, eq } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

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
    
    const db = getDatabase();
    
    await db
      .delete(featuredListings)
      .where(eq(featuredListings.listingId, listingId));
    
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

