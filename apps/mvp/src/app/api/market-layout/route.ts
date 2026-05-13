import { NextResponse } from "next/server";
import { resolveMarketSections } from "~/lib/server/homepage-layout";
import { withTimeout } from "~/lib/utils";
import { getDatabase, marketLayoutSnapshots, eq, desc } from '@cryptoart/db';

const SNAPSHOT_TTL_MS = 20 * 60_000;

export const maxDuration = 30;

export const revalidate = 120;

export async function GET() {
  try {
    const db = getDatabase();
    const [snapshot] = await db
      .select()
      .from(marketLayoutSnapshots)
      .where(eq(marketLayoutSnapshots.surface, 'market'))
      .orderBy(desc(marketLayoutSnapshots.updatedAt))
      .limit(1);

    const now = Date.now();
    if (snapshot) {
      const age = now - new Date(snapshot.updatedAt).getTime();
      if (age <= SNAPSHOT_TTL_MS) {
        const payload = snapshot.payload as { sections?: any[] };
        const response = NextResponse.json({ sections: payload?.sections ?? [] });
        response.headers.set(
          "Cache-Control",
          "public, s-maxage=120, stale-while-revalidate=300"
        );
        (async () => {
          try {
            const fresh = await withTimeout(resolveMarketSections(false), 25_000, []);
            await db
              .update(marketLayoutSnapshots)
              .set({ payload: { sections: fresh }, updatedAt: new Date() })
              .where(eq(marketLayoutSnapshots.id, snapshot.id));
          } catch (e) {
            console.error('[Market Layout] background refresh failed', e);
          }
        })();
        return response;
      }
    }

    const sections = await withTimeout(resolveMarketSections(false), 25_000, []);
    if (snapshot) {
      await db
        .update(marketLayoutSnapshots)
        .set({ payload: { sections }, updatedAt: new Date() })
        .where(eq(marketLayoutSnapshots.id, snapshot.id));
    } else {
      await db.insert(marketLayoutSnapshots).values({ surface: 'market', payload: { sections } });
    }

    const response = NextResponse.json({ sections });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=120, stale-while-revalidate=300"
    );
    return response;
  } catch (error) {
    console.error("[Market Layout] GET error", error);
    return NextResponse.json({ sections: [] });
  }
}
