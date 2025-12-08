import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, featuredSections, featuredSectionItems, eq } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

/**
 * PATCH /api/admin/featured-sections/[id]
 * Update a featured section
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, description, config, displayOrder, isActive, adminAddress } = body;
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    const db = getDatabase();
    
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (config !== undefined) updateData.config = config;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const [updatedSection] = await db
      .update(featuredSections)
      .set(updateData)
      .where(eq(featuredSections.id, id))
      .returning();
    
    if (!updatedSection) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ section: updatedSection });
  } catch (error) {
    console.error('[Admin] Error updating featured section:', error);
    return NextResponse.json(
      { error: 'Failed to update featured section' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/featured-sections/[id]
 * Delete a featured section (cascades to items)
 */
export async function DELETE(
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
    
    // Delete section (items will cascade delete)
    await db
      .delete(featuredSections)
      .where(eq(featuredSections.id, id));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] Error deleting featured section:', error);
    return NextResponse.json(
      { error: 'Failed to delete featured section' },
      { status: 500 }
    );
  }
}

