import { NextResponse } from 'next/server';
import { getDatabase, featuredListings, featuredSettings, asc } from '@cryptoart/db';
import { getAuctionServer } from '~/lib/server/auction';

/**
 * GET /api/featured
 * Get featured listings (public endpoint)
 */
export async function GET() {
  try {
    const db = getDatabase();
    
    // Get featured settings to check if auto mode is enabled
    const [settings] = await db
      .select()
      .from(featuredSettings)
      .limit(1);
    
    // Get featured listing IDs
    const featured = await db
      .select()
      .from(featuredListings)
      .orderBy(asc(featuredListings.displayOrder));
    
    if (featured.length === 0) {
      return NextResponse.json({ listings: [], autoMode: settings?.autoMode ?? false });
    }
    
    // Fetch full listing data for each featured listing
    const listings = await Promise.all(
      featured.map(async (f) => {
        const listing = await getAuctionServer(f.listingId);
        return listing ? { ...listing, displayOrder: f.displayOrder } : null;
      })
    );
    
    // Filter out null listings (ones that couldn't be found)
    const validListings = listings.filter(Boolean);
    
    return NextResponse.json({
      listings: validListings,
      autoMode: settings?.autoMode ?? false,
    });
  } catch (error) {
    console.error('[Featured] Error fetching featured listings:', error);
    return NextResponse.json(
      { listings: [], error: 'Failed to fetch featured listings' },
      { status: 500 }
    );
  }
}

