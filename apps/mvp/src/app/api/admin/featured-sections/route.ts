import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, featuredSections, featuredSectionItems, asc, eq } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

/**
 * GET /api/admin/featured-sections
 * Get all featured sections (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    const db = getDatabase();
    
    const sections = await db
      .select()
      .from(featuredSections)
      .orderBy(asc(featuredSections.displayOrder));
    
    // Get items for each section
    const sectionsWithItems = await Promise.all(
      sections.map(async (section) => {
        const items = await db
          .select()
          .from(featuredSectionItems)
          .where(eq(featuredSectionItems.sectionId, section.id))
          .orderBy(asc(featuredSectionItems.displayOrder));
        
        return {
          ...section,
          items,
        };
      })
    );
    
    return NextResponse.json({ sections: sectionsWithItems });
  } catch (error) {
    console.error('[Admin] Error fetching featured sections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch featured sections' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/featured-sections
 * Create a new featured section
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, title, description, config, displayOrder, adminAddress } = body;
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    if (!type || !title) {
      return NextResponse.json(
        { error: 'Type and title are required' },
        { status: 400 }
      );
    }
    
    const validTypes = ['featured_artists', 'recently_sold', 'upcoming', 'collection', 'custom'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    
    // Get max display order to append new section
    const maxOrderResult = await db
      .select()
      .from(featuredSections)
      .orderBy(asc(featuredSections.displayOrder))
      .limit(1);
    
    const newDisplayOrder = displayOrder !== undefined 
      ? displayOrder 
      : (maxOrderResult.length > 0 ? maxOrderResult[0].displayOrder + 1 : 0);
    
    const [newSection] = await db
      .insert(featuredSections)
      .values({
        type,
        title,
        description: description || null,
        config: config || null,
        displayOrder: newDisplayOrder,
        isActive: true,
      })
      .returning();
    
    return NextResponse.json({ section: newSection });
  } catch (error) {
    console.error('[Admin] Error creating featured section:', error);
    return NextResponse.json(
      { error: 'Failed to create featured section' },
      { status: 500 }
    );
  }
}

