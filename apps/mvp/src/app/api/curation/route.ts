import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, curation, curationItems, eq, and, asc, desc } from '@cryptoart/db';
import { getAuctionServer } from '~/lib/server/auction';
import { generateSlug } from '~/lib/utils/slug';
import { hasGalleryAccess } from '~/lib/server/nft-access';
import { isAddress } from 'viem';
import { MAX_GALLERIES_PER_USER } from '~/lib/constants';

/**
 * GET /api/curation?userAddress=...
 * Get all galleries for a user (or current user if no address provided)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');
    const publishedOnly = searchParams.get('publishedOnly') === 'true';
    
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
    
    // Build where condition
    const whereCondition = publishedOnly
      ? and(
          eq(curation.curatorAddress, normalizedAddress),
          eq(curation.isPublished, true)
        )
      : eq(curation.curatorAddress, normalizedAddress);
    
    // Execute query
    const galleries = await db
      .select()
      .from(curation)
      .where(whereCondition)
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
    console.error('[Curation API] Error fetching galleries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch galleries' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/curation
 * Create a new gallery
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userAddress, title, description, verifiedAddresses } = body;
    
    if (!userAddress || !title) {
      return NextResponse.json(
        { error: 'userAddress and title are required' },
        { status: 400 }
      );
    }
    
    // Validate address
    if (!isAddress(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }
    
    // Check if user has gallery access (NFT balance > 0 in any associated wallet)
    // verifiedAddresses is optional - provided by client-side hook for optimization
    const hasAccess = await hasGalleryAccess(
      userAddress as `0x${string}`,
      verifiedAddresses as string[] | undefined
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied. Gallery feature requires NFT ownership.' },
        { status: 403 }
      );
    }
    
    if (!title.trim()) {
      return NextResponse.json(
        { error: 'Title cannot be empty' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    const normalizedAddress = userAddress.toLowerCase();
    
    // Check if user has reached the maximum number of galleries
    const existingGalleries = await db
      .select()
      .from(curation)
      .where(eq(curation.curatorAddress, normalizedAddress));
    
    if (existingGalleries.length >= MAX_GALLERIES_PER_USER) {
      return NextResponse.json(
        { error: `You can only create up to ${MAX_GALLERIES_PER_USER} galleries.` },
        { status: 400 }
      );
    }
    
    // Generate slug from title
    const baseSlug = generateSlug(title);
    
    // Check if slug already exists for this user, append number if needed
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await db
        .select()
        .from(curation)
        .where(
          and(
            eq(curation.curatorAddress, normalizedAddress),
            eq(curation.slug, slug)
          )
        )
        .limit(1);
      
      if (existing.length === 0) {
        break; // Slug is available
      }
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    // Create gallery
    const [newGallery] = await db
      .insert(curation)
      .values({
        curatorAddress: normalizedAddress,
        title: title.trim(),
        description: description?.trim() || null,
        slug,
        isPublished: false,
      })
      .returning();
    
    return NextResponse.json({ gallery: newGallery });
  } catch (error) {
    console.error('[Curation API] Error creating gallery:', error);
    return NextResponse.json(
      { error: 'Failed to create gallery' },
      { status: 500 }
    );
  }
}

