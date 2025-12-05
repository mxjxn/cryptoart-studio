import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, featuredListings, asc } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';
import { getAuctionServer } from '~/lib/server/auction';

/**
 * GET /api/admin/featured
 * Get list of featured listings
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
    
    const listings = await db
      .select()
      .from(featuredListings)
      .orderBy(asc(featuredListings.displayOrder));
    
    return NextResponse.json({ listings });
  } catch (error) {
    console.error('[Admin] Error fetching featured listings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch featured listings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/featured
 * Add a listing to featured
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { listingId, adminAddress } = body;
    
    // Validate input
    if (!listingId) {
      return NextResponse.json(
        { error: 'Listing ID is required' },
        { status: 400 }
      );
    }
    
    // Verify admin
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    // Validate listing exists in subgraph
    const listing = await getAuctionServer(listingId);
    if (!listing) {
      return NextResponse.json(
        { error: `Listing ${listingId} not found` },
        { status: 404 }
      );
    }
    
    const db = getDatabase();
    
    // Get current max display order
    const existing = await db
      .select()
      .from(featuredListings)
      .orderBy(asc(featuredListings.displayOrder));
    
    const maxOrder = existing.length > 0 
      ? Math.max(...existing.map(l => l.displayOrder)) + 1 
      : 0;
    
    // Insert featured listing (ignore if already exists)
    await db.insert(featuredListings).values({
      listingId,
      displayOrder: maxOrder,
    }).onConflictDoNothing();
    
    console.log(`[Admin] Featured listing added: ${listingId} by ${adminAddress}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] Error adding featured listing:', error);
    return NextResponse.json(
      { error: 'Failed to add featured listing' },
      { status: 500 }
    );
  }
}

