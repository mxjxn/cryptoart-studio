import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, curation, curationItems, eq, and, desc } from '@cryptoart/db';
import { getAuctionServer } from '~/lib/server/auction';

/**
 * GET /api/curation/user/[address]
 * Get all published galleries for a user
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    
    // Validate address
    if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    const normalizedAddress = address.toLowerCase();
    
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

