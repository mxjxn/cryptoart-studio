import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, collectionTokens, eq, and, desc, sql } from '@cryptoart/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  try {
    const { collectionId } = await params;
    const { searchParams } = new URL(req.url);
    const owner = searchParams.get('owner');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const db = getDatabase();

    const conditions = [eq(collectionTokens.collectionId, collectionId)];
    if (owner) conditions.push(eq(collectionTokens.ownerAddress, owner.toLowerCase()));

    const where = and(...conditions);

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(collectionTokens)
        .where(where)
        .orderBy(desc(collectionTokens.mintedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(collectionTokens)
        .where(where),
    ]);

    return NextResponse.json({
      tokens: rows,
      total: Number(countResult[0]?.count ?? 0),
      limit,
      offset,
    });
  } catch (error) {
    console.error('[GET /api/collections/[id]/tokens] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 },
    );
  }
}
