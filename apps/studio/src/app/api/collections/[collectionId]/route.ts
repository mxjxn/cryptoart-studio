import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, collections, collectionExtensions, collectionRoyalties, eq, and } from '@cryptoart/db';
import { isAddress } from 'viem';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  try {
    const { collectionId } = await params;
    const db = getDatabase();

    const collectionRows = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    if (collectionRows.length === 0) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    const collection = collectionRows[0]!;

    const [extensions, royalties] = await Promise.all([
      db
        .select()
        .from(collectionExtensions)
        .where(eq(collectionExtensions.collectionId, collectionId)),
      db
        .select()
        .from(collectionRoyalties)
        .where(eq(collectionRoyalties.collectionId, collectionId)),
    ]);

    return NextResponse.json({
      ...collection,
      extensions,
      royalties,
    });
  } catch (error) {
    console.error('[GET /api/collections/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collection' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  try {
    const { collectionId } = await params;
    const body = await req.json();
    const { ownerAddress, description, imageUrl, bannerUrl } = body;

    if (!ownerAddress || !isAddress(ownerAddress)) {
      return NextResponse.json({ error: 'Valid ownerAddress is required' }, { status: 400 });
    }

    const db = getDatabase();

    const collectionRows = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    if (collectionRows.length === 0) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    if (collectionRows[0]!.ownerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (bannerUrl !== undefined) updates.bannerUrl = bannerUrl;

    await db
      .update(collections)
      .set(updates)
      .where(eq(collections.id, collectionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PATCH /api/collections/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update collection' },
      { status: 500 },
    );
  }
}
