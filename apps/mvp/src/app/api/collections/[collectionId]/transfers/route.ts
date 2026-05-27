import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, transferEvents, eq, and, desc, sql } from '@cryptoart/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  try {
    const { collectionId } = await params;
    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get('tokenId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const db = getDatabase();

    const conditions = [eq(transferEvents.collectionId, collectionId)];
    if (tokenId) conditions.push(eq(transferEvents.tokenId, parseInt(tokenId)));
    if (from) conditions.push(eq(transferEvents.fromAddress, from.toLowerCase()));
    if (to) conditions.push(eq(transferEvents.toAddress, to.toLowerCase()));

    const where = and(...conditions);

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(transferEvents)
        .where(where)
        .orderBy(desc(transferEvents.timestamp))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(transferEvents)
        .where(where),
    ]);

    return NextResponse.json({
      transfers: rows,
      total: Number(countResult[0]?.count ?? 0),
      limit,
      offset,
    });
  } catch (error) {
    console.error('[GET /api/collections/[id]/transfers] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfers' },
      { status: 500 },
    );
  }
}
