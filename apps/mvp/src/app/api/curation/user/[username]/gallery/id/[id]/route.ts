import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, curation, curationItems, eq, asc } from '@cryptoart/db';
import { getAuctionServer } from '~/lib/server/auction';
import { getUserFromCache } from '~/lib/server/user-cache';
import { lookupNeynarByUsername } from '~/lib/artist-name-resolution';

/**
 * GET /api/curation/user/[username]/gallery/id/[id]
 * Get a gallery by username and UUID (public endpoint for published galleries)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string; id: string }> }
) {
  try {
    const { username, id } = await params;
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress'); // For checking ownership
    
    // Resolve username to address (or use address directly if it's an address)
    let curatorAddress: string | null = null;
    
    // Check if it's already an address
    if (/^0x[a-fA-F0-9]{40}$/i.test(username)) {
      curatorAddress = username.toLowerCase();
    } else {
      // It's a username, resolve it
      const normalizedUsername = username.toLowerCase();
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
    
    // Get gallery by UUID
    const [gallery] = await db
      .select()
      .from(curation)
      .where(eq(curation.id, id))
      .limit(1);
    
    if (!gallery) {
      return NextResponse.json(
        { error: 'Gallery not found' },
        { status: 404 }
      );
    }
    
    // Verify the gallery belongs to the curator
    if (gallery.curatorAddress.toLowerCase() !== curatorAddress) {
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
    console.error('[Curation API] Error fetching gallery by username and id:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gallery' },
      { status: 500 }
    );
  }
}

