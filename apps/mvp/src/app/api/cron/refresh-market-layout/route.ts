import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, marketLayoutSnapshots } from '@cryptoart/db';
import { resolveMarketSections } from '~/lib/server/homepage-layout';

/**
 * GET /api/cron/refresh-market-layout
 * Triggered by Vercel cron to refresh the cached market layout snapshot.
 * Protected by CRON_SECRET header (Bearer token) or environment CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDatabase();
    const sections = await resolveMarketSections(false);

    // Upsert snapshot for 'market'
    const [existing] = await db
      .select()
      .from(marketLayoutSnapshots)
      .where(marketLayoutSnapshots.surface.equals('market'))
      .limit(1);

    if (existing) {
      await db
        .update(marketLayoutSnapshots)
        .set({ payload: { sections }, updatedAt: new Date() })
        .where(marketLayoutSnapshots.id.equals(existing.id));
    } else {
      await db.insert(marketLayoutSnapshots).values({ surface: 'market', payload: { sections } });
    }

    return NextResponse.json({ success: true, count: sections.length });
  } catch (error) {
    console.error('[Cron] refresh-market-layout failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
