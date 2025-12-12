import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, curation, curationItems, eq, and, asc } from '@cryptoart/db';
import { getAuctionServer } from '~/lib/server/auction';
import { hasGalleryAccess } from '~/lib/server/nft-access';
import { prerenderGalleryOGImage } from '~/lib/server/gallery-og-prerender';
import { getUserFromCache } from '~/lib/server/user-cache';
import { isAddress } from 'viem';

/**
 * POST /api/curation/[id]/items
 * Add listing(s) to a gallery
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { userAddress, listingIds, notes, verifiedAddresses } = body;
    
    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
        { status: 400 }
      );
    }
    
    if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json(
        { error: 'listingIds array is required' },
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
    
    // Get current max display order
    const currentItems = await db
      .select()
      .from(curationItems)
      .where(eq(curationItems.curationId, id))
      .orderBy(asc(curationItems.displayOrder));
    
    let nextDisplayOrder = currentItems.length > 0
      ? Math.max(...currentItems.map(item => item.displayOrder)) + 1
      : 0;
    
    // Add listings (skip duplicates)
    const addedItems = [];
    const skippedItems = [];
    
    for (const listingId of listingIds) {
      // Check if already exists
      const existing = await db
        .select()
        .from(curationItems)
        .where(
          and(
            eq(curationItems.curationId, id),
            eq(curationItems.listingId, listingId)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        skippedItems.push(listingId);
        continue;
      }
      
      // Verify listing exists
      const listing = await getAuctionServer(listingId);
      if (!listing) {
        skippedItems.push(listingId);
        continue;
      }
      
      // Add item
      const [newItem] = await db
        .insert(curationItems)
        .values({
          curationId: id,
          listingId,
          displayOrder: nextDisplayOrder++,
          notes: notes || null,
        })
        .returning();
      
      addedItems.push(newItem);
    }
    
    // Pre-render OG image after items are added (fire and forget)
    if (addedItems.length > 0) {
      // Get username from curator address for OG image pre-rendering
      const getUserName = async () => {
        try {
          // Try to get username from user cache
          const user = await getUserFromCache(gallery.curatorAddress);
          if (user?.username) {
            return user.username;
          }
          // If no username found, we can't pre-render (would need address-based lookup)
          return null;
        } catch (error) {
          console.warn('[Curation API] Error fetching username for OG pre-render:', error);
          return null;
        }
      };
      
      // Pre-render in background (don't block response)
      getUserName().then((username) => {
        if (username && gallery.slug) {
          prerenderGalleryOGImage(username, gallery.slug).catch((error) => {
            console.warn('[Curation API] Error pre-rendering gallery OG image:', error);
          });
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      added: addedItems.length,
      skipped: skippedItems.length,
      items: addedItems,
    });
  } catch (error) {
    console.error('[Curation API] Error adding items:', error);
    return NextResponse.json(
      { error: 'Failed to add items to gallery' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/curation/[id]/items?listingId=...&userAddress=...
 * Remove a listing from a gallery
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');
    const listingId = searchParams.get('listingId');
    const verifiedAddressesParam = searchParams.get('verifiedAddresses');
    const verifiedAddresses = verifiedAddressesParam ? JSON.parse(verifiedAddressesParam) : undefined;
    
    if (!userAddress || !listingId) {
      return NextResponse.json(
        { error: 'userAddress and listingId are required' },
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
    
    // Delete item
    await db
      .delete(curationItems)
      .where(
        and(
          eq(curationItems.curationId, id),
          eq(curationItems.listingId, listingId)
        )
      );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Curation API] Error removing item:', error);
    return NextResponse.json(
      { error: 'Failed to remove item from gallery' },
      { status: 500 }
    );
  }
}

