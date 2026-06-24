import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, collectionTokens, transferEvents, eq, and, desc } from '@cryptoart/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string; tokenId: string }> },
) {
  try {
    const { collectionId, tokenId } = await params;
    const db = getDatabase();

    const tokenRows = await db
      .select()
      .from(collectionTokens)
      .where(
        and(
          eq(collectionTokens.collectionId, collectionId),
          eq(collectionTokens.tokenId, parseInt(tokenId)),
        ),
      )
      .limit(1);

    if (tokenRows.length === 0) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    const token = tokenRows[0]!;

    const transferHistory = await db
      .select()
      .from(transferEvents)
      .where(
        and(
          eq(transferEvents.collectionId, collectionId),
          eq(transferEvents.tokenId, parseInt(tokenId)),
        ),
      )
      .orderBy(desc(transferEvents.timestamp));

    return NextResponse.json({
      ...token,
      transferHistory,
    });
  } catch (error) {
    console.error('[GET /api/collections/[id]/tokens/[tokenId]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token' },
      { status: 500 },
    );
  }
}
