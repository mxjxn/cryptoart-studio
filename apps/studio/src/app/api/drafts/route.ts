import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, collectionDrafts, eq, desc } from '@cryptoart/db';
import { isAddress } from 'viem';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const owner = searchParams.get('owner');

    if (!owner || !isAddress(owner)) {
      return NextResponse.json({ error: 'Valid owner address is required' }, { status: 400 });
    }

    const db = getDatabase();
    const rows = await db
      .select()
      .from(collectionDrafts)
      .where(eq(collectionDrafts.ownerAddress, owner.toLowerCase()))
      .orderBy(desc(collectionDrafts.updatedAt));

    return NextResponse.json({ drafts: rows });
  } catch (error) {
    console.error('[GET /api/drafts] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ownerAddress, payload } = body;

    if (!ownerAddress || !isAddress(ownerAddress)) {
      return NextResponse.json({ error: 'Valid ownerAddress is required' }, { status: 400 });
    }

    const db = getDatabase();
    const [draft] = await db
      .insert(collectionDrafts)
      .values({
        ownerAddress: ownerAddress.toLowerCase(),
        payload: payload ?? { step: 1 },
      })
      .returning();

    return NextResponse.json(draft);
  } catch (error) {
    console.error('[POST /api/drafts] Error:', error);
    return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 });
  }
}
