import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, curation, curationItems, eq, and, desc } from '@cryptoart/db';
import { getAuctionServer } from '~/lib/server/auction';
import { getUserFromCache } from '~/lib/server/user-cache';
import { lookupNeynarByUsername } from '~/lib/artist-name-resolution';

/**
 * GET /api/curation/user/[identifier]
 * Get all published galleries for a user (identifier can be address or username)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params;
    
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
    const normalizedAddress = curatorAddress;
    
    // Get only published galleries
    const galleries = await db
      .select()
      .from(curation)
      .where(
        and(
          eq(curation.curatorAddress, normalizedAddress),
          eq(curation.isPublished, true)
        )
      )
      .orderBy(desc(curation.createdAt));
    
    // Get item counts for each gallery
    const galleriesWithCounts = await Promise.all(
      galleries.map(async (gallery) => {
        const items = await db
          .select()
          .from(curationItems)
          .where(eq(curationItems.curationId, gallery.id));
        
        return {
          ...gallery,
          itemCount: items.length,
        };
      })
    );
    
    return NextResponse.json({ galleries: galleriesWithCounts });
  } catch (error) {
    console.error('[Curation API] Error fetching user galleries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user galleries' },
      { status: 500 }
    );
  }
}

