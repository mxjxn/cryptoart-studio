import { getDatabase, marketLayoutSnapshots, eq, desc } from "@cryptoart/db";
import type { HomepageSection } from "~/lib/server/homepage-layout";

/** Fast path for /market SSR: read the cron/API snapshot, never live-resolve rails. */
export async function readMarketLayoutSnapshot(): Promise<HomepageSection[]> {
  try {
    const db = getDatabase();
    const [snapshot] = await db
      .select()
      .from(marketLayoutSnapshots)
      .where(eq(marketLayoutSnapshots.surface, "market"))
      .orderBy(desc(marketLayoutSnapshots.updatedAt))
      .limit(1);

    const payload = snapshot?.payload as { sections?: HomepageSection[] } | undefined;
    return Array.isArray(payload?.sections) ? payload.sections : [];
  } catch (error) {
    console.error("[Market Layout] snapshot read failed", error);
    return [];
  }
}
