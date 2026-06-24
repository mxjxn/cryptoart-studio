import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, collections, eq, and, desc, sql } from '@cryptoart/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const owner = searchParams.get('owner');
    const chainId = searchParams.get('chainId');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const db = getDatabase();

    const conditions = [];
    if (owner) conditions.push(eq(collections.ownerAddress, owner.toLowerCase()));
    if (chainId) conditions.push(eq(collections.chainId, parseInt(chainId)));
    if (status) conditions.push(eq(collections.status, status));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(collections)
        .where(where)
        .orderBy(desc(collections.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(collections)
        .where(where),
    ]);

    return NextResponse.json({
      collections: rows,
      total: Number(countResult[0]?.count ?? 0),
      limit,
      offset,
    });
  } catch (error) {
    console.error('[GET /api/collections] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 },
    );
  }
}
