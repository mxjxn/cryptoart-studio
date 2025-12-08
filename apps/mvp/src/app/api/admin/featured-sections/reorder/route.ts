import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, featuredSections, eq } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

/**
 * POST /api/admin/featured-sections/reorder
 * Update display order of multiple sections
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sectionOrders, adminAddress } = body;
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    if (!Array.isArray(sectionOrders)) {
      return NextResponse.json(
        { error: 'sectionOrders must be an array of { id, displayOrder }' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    
    // Update each section's display order
    await Promise.all(
      sectionOrders.map(({ id, displayOrder }: { id: string; displayOrder: number }) =>
        db
          .update(featuredSections)
          .set({ displayOrder, updatedAt: new Date() })
          .where(eq(featuredSections.id, id))
      )
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] Error reordering featured sections:', error);
    return NextResponse.json(
      { error: 'Failed to reorder featured sections' },
      { status: 500 }
    );
  }
}

