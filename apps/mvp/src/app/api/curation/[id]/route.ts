import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, curation, curationItems, eq, and, asc } from '@cryptoart/db';
import { getAuctionServer } from '~/lib/server/auction';
import { generateSlug } from '~/lib/utils/slug';
import { hasGalleryAccess } from '~/lib/server/nft-access';
import { isAddress } from 'viem';

/**
 * GET /api/curation/[id]?userAddress=...
 * Get a single gallery with its listings
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');
    
    const db = getDatabase();
    
    // Get gallery
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
    
    // Check if user can view (must be owner or published)
    const normalizedAddress = userAddress?.toLowerCase();
    const isOwner = normalizedAddress && gallery.curatorAddress.toLowerCase() === normalizedAddress;
    
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
      .where(eq(curationItems.curationId, id))
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
    console.error('[Curation API] Error fetching gallery:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gallery' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/curation/[id]
 * Update a gallery
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { userAddress, title, description, isPublished, verifiedAddresses } = body;
    
    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
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
    
    const db = getDatabase();
    const normalizedAddress = userAddress.toLowerCase();
    
    // Check if gallery exists and user owns it
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
    
    if (gallery.curatorAddress.toLowerCase() !== normalizedAddress) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Build update data
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json(
          { error: 'Title cannot be empty' },
          { status: 400 }
        );
      }
      updateData.title = title.trim();
      
      // Regenerate slug if title changed
      const baseSlug = generateSlug(title.trim());
      let slug = baseSlug;
      let counter = 1;
      
      // Check if new slug conflicts (excluding current gallery)
      while (true) {
        const existing = await db
          .select()
          .from(curation)
          .where(
            and(
              eq(curation.curatorAddress, normalizedAddress),
              eq(curation.slug, slug),
              eq(curation.id, id) // Exclude current gallery
            )
          )
          .limit(1);
        
        // If we find a different gallery with this slug, try next number
        const conflicting = existing.find(g => g.id !== id);
        if (!conflicting) {
          break; // Slug is available
        }
        
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      updateData.slug = slug;
    }
    
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }
    
    if (isPublished !== undefined) {
      updateData.isPublished = isPublished;
    }
    
    // Update gallery
    const [updatedGallery] = await db
      .update(curation)
      .set(updateData)
      .where(eq(curation.id, id))
      .returning();
    
    return NextResponse.json({ gallery: updatedGallery });
  } catch (error) {
    console.error('[Curation API] Error updating gallery:', error);
    return NextResponse.json(
      { error: 'Failed to update gallery' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/curation/[id]
 * Delete a gallery (cascades to items)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');
    const verifiedAddressesParam = searchParams.get('verifiedAddresses');
    const verifiedAddresses = verifiedAddressesParam ? JSON.parse(verifiedAddressesParam) : undefined;
    
    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
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
    
    const db = getDatabase();
    const normalizedAddress = userAddress.toLowerCase();
    
    // Check if gallery exists and user owns it
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
    
    if (gallery.curatorAddress.toLowerCase() !== normalizedAddress) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Delete gallery (items will cascade delete)
    await db
      .delete(curation)
      .where(eq(curation.id, id));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Curation API] Error deleting gallery:', error);
    return NextResponse.json(
      { error: 'Failed to delete gallery' },
      { status: 500 }
    );
  }
}

