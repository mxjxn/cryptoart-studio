import { NextResponse } from "next/server";
import { resolveMarketSections } from "~/lib/server/homepage-layout";
import { withTimeout } from "~/lib/utils";
import { getDatabase, marketLayoutSnapshots } from '@cryptoart/db';

const SNAPSHOT_TTL_MS = 2 * 60_000; // 2 minutes

export const maxDuration = 30;

/** ISR: market rails refresh periodically; listing artwork still cached per token elsewhere. */
export const revalidate = 120;

export async function GET() {
  try {
    const db = getDatabase();
    // Try latest snapshot first
    const [snapshot] = await db
      .select()
      .from(marketLayoutSnapshots)
      .where(marketLayoutSnapshots.surface.equals('market'))
      .orderBy(marketLayoutSnapshots.updatedAt.desc)
      .limit(1);

    const now = Date.now();
    if (snapshot) {
      const age = now - new Date(snapshot.updatedAt).getTime();
      // If snapshot is recent, return it immediately while triggering background refresh
      if (age <= SNAPSHOT_TTL_MS) {
        const response = NextResponse.json({ sections: snapshot.payload.sections });
        response.headers.set(
          "Cache-Control",
          "public, s-maxage=120, stale-while-revalidate=300"
        );
        // Kick off async refresh, do not await
        (async () => {
          try {
            const fresh = await withTimeout(resolveMarketSections(false), 25_000, []);
            await db
              .update(marketLayoutSnapshots)
              .set({ payload: { sections: fresh }, updatedAt: new Date() })
              .where(marketLayoutSnapshots.id.equals(snapshot.id));
          } catch (e) {
            console.error('[Market Layout] background refresh failed', e);
          }
        })();
        return response;
      }
    }

    // No recent snapshot: resolve now (with timeout) and upsert snapshot
    const sections = await withTimeout(resolveMarketSections(false), 25_000, []);
    if (snapshot) {
      await db
        .update(marketLayoutSnapshots)
        .set({ payload: { sections }, updatedAt: new Date() })
        .where(marketLayoutSnapshots.id.equals(snapshot.id));
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
