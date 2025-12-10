import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, curation, curationItems, eq, and, asc, desc } from '@cryptoart/db';
import { getAuctionServer } from '~/lib/server/auction';
import { getUserFromCache } from '~/lib/server/user-cache';
import { lookupNeynarByUsername } from '~/lib/artist-name-resolution';

/**
 * GET /api/curation/user/[identifier]/gallery/[slug]
 * Get a gallery by identifier (address or username) and slug (public endpoint for published galleries)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ identifier: string; slug: string }> }
) {
  try {
    const { identifier, slug } = await params;
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress'); // For checking ownership
    
    // Resolve identifier to address (or use address directly if it's an address)
    let curatorAddress: string | null = null;
    
    // Check if it's already an address
    if (/^0x[a-fA-F0-9]{40}$/i.test(identifier)) {
      curatorAddress = identifier.toLowerCase();
    } else {
      // It's a username, resolve it
      const normalizedUsername = identifier.toLowerCase();
      const user = await getUserFromCache(normalizedUsername);
      if (user && user.ethAddress) {
        curatorAddress = user.ethAddress.toLowerCase();
      } else {
        // Fallback to Neynar lookup
        const neynarUser = await lookupNeynarByUsername(normalizedUsername);
        if (neynarUser && neynarUser.address) {
          curatorAddress = neynarUser.address.toLowerCase();
        }
      }
    }
    
    if (!curatorAddress) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const db = getDatabase();
    
    let gallery;
    
    // Check if slug is numeric (gallery index)
    const numericSlug = /^\d+$/.test(slug);
    
    if (numericSlug) {
      // Get galleries ordered by creation date (newest first, index 1 = newest)
      const allGalleries = await db
        .select()
        .from(curation)
        .where(eq(curation.curatorAddress, curatorAddress))
        .orderBy(desc(curation.createdAt));
      
      const index = parseInt(slug, 10) - 1; // Convert to 0-based index
      if (index >= 0 && index < allGalleries.length) {
        gallery = allGalleries[index];
      }
    } else {
      // Get gallery by slug
      const [foundGallery] = await db
        .select()
        .from(curation)
        .where(
          and(
            eq(curation.curatorAddress, curatorAddress),
            eq(curation.slug, slug)
          )
        )
        .limit(1);
      gallery = foundGallery;
    }
    
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
    console.error('[Curation API] Error fetching gallery by username and slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gallery' },
      { status: 500 }
    );
  }
}

