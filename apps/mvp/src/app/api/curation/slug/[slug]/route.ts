import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, curation, curationItems, eq, and, asc } from '@cryptoart/db';
import { getAuctionServer } from '~/lib/server/auction';

/**
 * GET /api/curation/slug/[slug]?curatorAddress=...
 * Get a gallery by slug (public endpoint for published galleries)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const curatorAddress = searchParams.get('curatorAddress');
    const userAddress = searchParams.get('userAddress'); // For checking ownership
    
    if (!curatorAddress) {
      return NextResponse.json(
        { error: 'curatorAddress is required' },
        { status: 400 }
      );
    }
    
    // Validate address
    if (!/^0x[a-fA-F0-9]{40}$/i.test(curatorAddress)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    const normalizedCuratorAddress = curatorAddress.toLowerCase();
    
    // Get gallery by slug and curator
    const [gallery] = await db
      .select()
      .from(curation)
      .where(
        and(
          eq(curation.curatorAddress, normalizedCuratorAddress),
          eq(curation.slug, slug)
        )
      )
      .limit(1);
    
    if (!gallery) {
      return NextResponse.json(
        { error: 'Gallery not found' },
        { status: 404 }
      );
    }
    
    // Check if user can view (must be owner or published)
    const normalizedUserAddress = userAddress?.toLowerCase();
    const isOwner = normalizedUserAddress && gallery.curatorAddress.toLowerCase() === normalizedUserAddress;
    
    if (!gallery.isPublished && !isOwner) {
      return NextResponse.json(
        { error: 'Gallery not found' },
        { status: 404 }
      );
    }
    
    // Get items
    const items = await db
      .select()
      .from(curationItems)
      .where(eq(curationItems.curationId, gallery.id))
      .orderBy(asc(curationItems.displayOrder));
    
    // Fetch full listing data
    const listings = await Promise.all(
      items.map(async (item) => {
        const listing = await getAuctionServer(item.listingId);
        return listing ? {
          ...listing,
          displayOrder: item.displayOrder,
          notes: item.notes,
          addedAt: item.addedAt,
        } : null;
      })
    );
    
    const validListings = listings.filter(Boolean);
    
    return NextResponse.json({
      gallery: {
        ...gallery,
        listings: validListings,
        itemCount: validListings.length,
      },
    });
  } catch (error) {
    console.error('[Curation API] Error fetching gallery by slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gallery' },
      { status: 500 }
    );
  }
}

