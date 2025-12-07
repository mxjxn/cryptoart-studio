import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, favorites, eq, and } from '@cryptoart/db';

/**
 * POST /api/favorite
 * Favorite a listing
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userAddress, listingId } = body;
    
    if (!userAddress || !listingId) {
      return NextResponse.json(
        { error: 'userAddress and listingId are required' },
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
    
    // Check if already favorited
    const existing = await db.select()
      .from(favorites)
      .where(
        and(
          eq(favorites.userAddress, normalizedAddress),
          eq(favorites.listingId, listingId)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return NextResponse.json({ 
        success: true, 
        favorited: true,
        message: 'Already favorited' 
      });
    }
    
    // Create favorite
    const [result] = await db.insert(favorites)
      .values({
        userAddress: normalizedAddress,
        listingId: listingId,
      })
      .returning();
    
    return NextResponse.json({ 
      success: true, 
      favorited: true,
      favorite: result 
    });
  } catch (error) {
    console.error('[favorite API] Error favoriting listing:', error);
    return NextResponse.json(
      { error: 'Failed to favorite listing' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/favorite
 * Unfavorite a listing
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');
    const listingId = searchParams.get('listingId');
    
    if (!userAddress || !listingId) {
      return NextResponse.json(
        { error: 'userAddress and listingId are required' },
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
    
    // Delete favorite
    const result = await db.delete(favorites)
      .where(
        and(
          eq(favorites.userAddress, normalizedAddress),
          eq(favorites.listingId, listingId)
        )
      )
      .returning();
    
    return NextResponse.json({ 
      success: true, 
      favorited: false,
      message: 'Unfavorited successfully' 
    });
  } catch (error) {
    console.error('[favorite API] Error unfavoriting listing:', error);
    return NextResponse.json(
      { error: 'Failed to unfavorite listing' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/favorite
 * Check if listing is favorited, or get all favorites for a user
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');
    const listingId = searchParams.get('listingId');
    
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
    
    // If listingId provided, check if specific listing is favorited
    if (listingId) {
      const existing = await db.select()
        .from(favorites)
        .where(
          and(
            eq(favorites.userAddress, normalizedAddress),
            eq(favorites.listingId, listingId)
          )
        )
        .limit(1);
      
      return NextResponse.json({ 
        favorited: existing.length > 0 
      });
    }
    
    // Otherwise, get all favorites for user
    const userFavorites = await db.select()
      .from(favorites)
      .where(eq(favorites.userAddress, normalizedAddress))
      .orderBy(favorites.createdAt);
    
    return NextResponse.json({ 
      favorites: userFavorites.map(f => f.listingId) 
    });
  } catch (error) {
    console.error('[favorite API] Error fetching favorites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}



