import { NextResponse } from 'next/server';
import { getDatabase, featuredSections, featuredSectionItems, asc, eq, and } from '@cryptoart/db';
import { getAuctionServer } from '~/lib/server/auction';
import { browseListings } from '~/lib/server/browse-listings';

/**
 * GET /api/featured-sections
 * Get all active featured sections with their items
 */
export async function GET() {
  try {
    const db = getDatabase();
    
    // Get all active featured sections ordered by display order
    const sections = await db
      .select()
      .from(featuredSections)
      .where(eq(featuredSections.isActive, true))
      .orderBy(asc(featuredSections.displayOrder));
    
    if (sections.length === 0) {
      return NextResponse.json({ sections: [] });
    }
    
    // For each section, fetch items and resolve listings
    const sectionsWithItems = await Promise.all(
      sections.map(async (section) => {
        // Get items for this section
        const items = await db
          .select()
          .from(featuredSectionItems)
          .where(eq(featuredSectionItems.sectionId, section.id))
          .orderBy(asc(featuredSectionItems.displayOrder));
        
        // Resolve listings based on section type and items
        let listings: any[] = [];
        
        if (section.type === 'custom') {
          // Custom: Use manually added items
          const listingItems = items.filter(item => item.itemType === 'listing');
          listings = await Promise.all(
            listingItems.map(async (item) => {
              const listing = await getAuctionServer(item.itemId);
              return listing ? { ...listing, displayOrder: item.displayOrder } : null;
            })
          );
          listings = listings.filter(Boolean);
        } else if (section.type === 'featured_artists') {
          // Featured Artists: Query listings by artist addresses from config
          const artistAddresses = (section.config as any)?.artistAddresses || [];
          if (artistAddresses.length > 0) {
            // Fetch listings for these artists (simplified - would need subgraph query)
            // For now, use items if they exist
            const listingItems = items.filter(item => item.itemType === 'listing');
            listings = await Promise.all(
              listingItems.map(async (item) => {
                const listing = await getAuctionServer(item.itemId);
                return listing ? { ...listing, displayOrder: item.displayOrder } : null;
              })
            );
            listings = listings.filter(Boolean);
          }
        } else if (section.type === 'recently_sold') {
          // Recently Sold: Use items if manually added, otherwise use recent listings
          // Note: For now, we'll use items. In the future, we can query finalized listings from subgraph
          const listingItems = items.filter(item => item.itemType === 'listing');
          if (listingItems.length > 0) {
            listings = await Promise.all(
              listingItems.map(async (item) => {
                const listing = await getAuctionServer(item.itemId);
                return listing ? { ...listing, displayOrder: item.displayOrder } : null;
              })
            );
            listings = listings.filter(Boolean);
          }
        } else if (section.type === 'upcoming') {
          // Upcoming: Use items if manually added
          const listingItems = items.filter(item => item.itemType === 'listing');
          if (listingItems.length > 0) {
            listings = await Promise.all(
              listingItems.map(async (item) => {
                const listing = await getAuctionServer(item.itemId);
                return listing ? { ...listing, displayOrder: item.displayOrder } : null;
              })
            );
            listings = listings.filter(Boolean);
          }
        } else if (section.type === 'collection') {
          // Collection: Use items if manually added
          const listingItems = items.filter(item => item.itemType === 'listing');
          if (listingItems.length > 0) {
            listings = await Promise.all(
              listingItems.map(async (item) => {
                const listing = await getAuctionServer(item.itemId);
                return listing ? { ...listing, displayOrder: item.displayOrder } : null;
              })
            );
            listings = listings.filter(Boolean);
          }
        }
        
        return {
          ...section,
          listings,
        };
      })
    );
    
    return NextResponse.json({ sections: sectionsWithItems });
  } catch (error) {
    console.error('[Featured Sections] Error fetching featured sections:', error);
    return NextResponse.json(
      { sections: [], error: 'Failed to fetch featured sections' },
      { status: 500 }
    );
  }
}

