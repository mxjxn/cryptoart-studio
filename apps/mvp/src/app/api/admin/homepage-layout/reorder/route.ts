import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, homepageLayoutSections, sql } from '@cryptoart/db';
import { verifyAdmin } from '~/lib/server/admin';

interface ReorderInput {
  id: string;
  displayOrder: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminAddress, sections } = body as { adminAddress?: string; sections: ReorderInput[] };

    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    if (!Array.isArray(sections)) {
      return NextResponse.json({ error: 'sections must be an array' }, { status: 400 });
    }

    const db = getDatabase();
    for (const section of sections) {
      if (!section.id) continue;
      await db
        .update(homepageLayoutSections)
        .set({ displayOrder: section.displayOrder, updatedAt: new Date() })
        .where(sql`${homepageLayoutSections.id} = ${section.id}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Homepage Layout] REORDER error', error);
    return NextResponse.json({ error: 'Failed to reorder homepage sections' }, { status: 500 });
  }
}

