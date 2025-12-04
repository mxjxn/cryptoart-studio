import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, favorites, eq, desc } from '@cryptoart/db';
import { getAuction } from '~/lib/subgraph';
import type { EnrichedAuctionData } from '~/lib/types';

/**
 * GET /api/favorites/listings
 * Get all favorited listings with full data
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');
    
    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
        { status: 400 }
      );
    }
    
    // Validate address
    if (!/^0x[a-fA-F0-9]{40}$/i.test(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    const normalizedAddress = userAddress.toLowerCase();
    
    // Get all favorite listing IDs for user
    const userFavorites = await db.select()
      .from(favorites)
      .where(eq(favorites.userAddress, normalizedAddress))
      .orderBy(desc(favorites.createdAt));
    
    if (userFavorites.length === 0) {
      return NextResponse.json({ 
        listings: [] 
      });
    }
    
    // Fetch full listing data for each favorited listing
    const listingIds = userFavorites.map(f => f.listingId);
    const listings: EnrichedAuctionData[] = [];
    
    // Fetch listings in parallel
    const listingPromises = listingIds.map(async (listingId) => {
      try {
        const auction = await getAuction(listingId);
        return auction;
      } catch (error) {
        console.error(`[favorites/listings] Error fetching listing ${listingId}:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(listingPromises);
    const validListings = results.filter((listing): listing is EnrichedAuctionData => listing !== null);
    
    return NextResponse.json({ 
      listings: validListings 
    });
  } catch (error) {
    console.error('[favorites/listings API] Error fetching favorited listings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorited listings' },
      { status: 500 }
    );
  }
}

