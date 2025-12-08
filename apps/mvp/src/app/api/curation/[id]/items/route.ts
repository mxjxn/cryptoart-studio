import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, curation, curationItems, eq, and, asc } from '@cryptoart/db';
import { getAuctionServer } from '~/lib/server/auction';

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
    const { userAddress, listingIds, notes } = body;
    
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
    if (!/^0x[a-fA-F0-9]{40}$/i.test(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
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

