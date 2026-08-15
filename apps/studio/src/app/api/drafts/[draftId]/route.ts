import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, collectionDrafts, eq } from '@cryptoart/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ draftId: string }> },
) {
  try {
    const { draftId } = await params;
    const db = getDatabase();

    const rows = await db
      .select()
      .from(collectionDrafts)
      .where(eq(collectionDrafts.id, draftId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('[GET /api/drafts/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch draft' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ draftId: string }> },
) {
  try {
    const { draftId } = await params;
    const body = await req.json();
    const { payload } = body;

    const db = getDatabase();

    const rows = await db
      .select()
      .from(collectionDrafts)
      .where(eq(collectionDrafts.id, draftId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    await db
      .update(collectionDrafts)
      .set({ payload, updatedAt: new Date() })
      .where(eq(collectionDrafts.id, draftId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PATCH /api/drafts/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ draftId: string }> },
) {
  try {
    const { draftId } = await params;
    const db = getDatabase();

    await db.delete(collectionDrafts).where(eq(collectionDrafts.id, draftId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/drafts/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
}
