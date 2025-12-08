import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, featuredSectionItems, eq, asc } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

/**
 * GET /api/admin/featured-sections/[id]/items
 * Get items for a section
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    const db = getDatabase();
    
    const items = await db
      .select()
      .from(featuredSectionItems)
      .where(eq(featuredSectionItems.sectionId, id))
      .orderBy(asc(featuredSectionItems.displayOrder));
    
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[Admin] Error fetching section items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch section items' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/featured-sections/[id]/items
 * Add an item to a section
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { itemType, itemId, displayOrder, metadata, adminAddress } = body;
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    if (!itemType || !itemId) {
      return NextResponse.json(
        { error: 'itemType and itemId are required' },
        { status: 400 }
      );
    }
    
    const validItemTypes = ['listing', 'artist', 'collection'];
    if (!validItemTypes.includes(itemType)) {
      return NextResponse.json(
        { error: `Invalid itemType. Must be one of: ${validItemTypes.join(', ')}` },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    
    // Get max display order
    const maxOrderResult = await db
      .select()
      .from(featuredSectionItems)
      .where(eq(featuredSectionItems.sectionId, id))
      .orderBy(asc(featuredSectionItems.displayOrder))
      .limit(1);
    
    const newDisplayOrder = displayOrder !== undefined 
      ? displayOrder 
      : (maxOrderResult.length > 0 ? maxOrderResult[0].displayOrder + 1 : 0);
    
    const [newItem] = await db
      .insert(featuredSectionItems)
      .values({
        sectionId: id,
        itemType,
        itemId,
        displayOrder: newDisplayOrder,
        metadata: metadata || null,
      })
      .returning();
    
    return NextResponse.json({ item: newItem });
  } catch (error) {
    console.error('[Admin] Error adding section item:', error);
    return NextResponse.json(
      { error: 'Failed to add section item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/featured-sections/[id]/items
 * Remove an item from a section (itemId in query params)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');
    const itemId = searchParams.get('itemId');
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    if (!itemId) {
      return NextResponse.json(
        { error: 'itemId is required' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    
    await db
      .delete(featuredSectionItems)
      .where(eq(featuredSectionItems.id, itemId));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] Error deleting section item:', error);
    return NextResponse.json(
      { error: 'Failed to delete section item' },
      { status: 500 }
    );
  }
}

