import { NextResponse } from 'next/server';
import { getDatabase, featuredListings, featuredSettings, asc } from '@cryptoart/db';
import { getAuctionServer, getHiddenUserAddresses } from '~/lib/server/auction';

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
    
    // Get hidden user addresses for filtering
    const hiddenAddresses = await getHiddenUserAddresses();
    
    // Fetch full listing data for each featured listing
    const listings = await Promise.all(
      featured.map(async (f) => {
        const listing = await getAuctionServer(f.listingId);
        if (!listing) {
          return null;
        }
        
        // Filter out banned/hidden users
        if (listing.seller && hiddenAddresses.has(listing.seller.toLowerCase())) {
          console.log(`[Featured] Filtering out featured listing ${f.listingId}: seller ${listing.seller} is hidden`);
          return null;
        }
        
        // Filter out cancelled, finalized, or sold-out listings
        if (listing.status === "CANCELLED" || listing.status === "FINALIZED") {
          return null;
        }
        
        const totalAvailable = parseInt(listing.totalAvailable || "0");
        const totalSold = parseInt(listing.totalSold || "0");
        const isFullySold = totalAvailable > 0 && totalSold >= totalAvailable;
        if (isFullySold) {
          return null;
        }
        
        return { ...listing, displayOrder: f.displayOrder };
      })
    );
    
    // Filter out null listings (ones that couldn't be found or were filtered out)
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

