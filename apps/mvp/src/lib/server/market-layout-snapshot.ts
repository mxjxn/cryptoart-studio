import { desc, eq, getDatabase, marketLayoutSnapshots } from "@cryptoart/db";
import type { HomepageSection } from "~/lib/server/homepage-layout";
import { resolveMarketSections } from "~/lib/server/homepage-layout";

const MARKET_LAYOUT_LIVE_TIMEOUT_MS = 25_000;
export const MARKET_LAYOUT_SNAPSHOT_TTL_MS = 60 * 60_000;

type SnapshotRow = {
  id: string;
  updatedAt: Date;
  payload: unknown;
};

type BoundedSectionsResult = {
  sections: HomepageSection[];
  timedOut: boolean;
};

type MarketLayoutSectionsDeps = {
  readSnapshot?: () => Promise<SnapshotRow | null>;
  persistSnapshot?: (snapshotId: string | null, sections: HomepageSection[]) => Promise<void>;
  resolveLiveSections?: () => Promise<HomepageSection[]>;
  nowMs?: () => number;
  snapshotTtlMs?: number;
  liveTimeoutMs?: number;
};

export function extractMarketLayoutSnapshotSections(payload: unknown): HomepageSection[] {
  if (!payload || typeof payload !== "object") return [];
  const sections = (payload as { sections?: unknown }).sections;
  return Array.isArray(sections) ? (sections as HomepageSection[]) : [];
}

export function isMarketLayoutSnapshotFresh(
  updatedAt: Date,
  nowMs: number,
  snapshotTtlMs: number
): boolean {
  return nowMs - updatedAt.getTime() <= snapshotTtlMs;
}

async function readLatestMarketLayoutSnapshot(): Promise<SnapshotRow | null> {
  const db = getDatabase();
  const [snapshot] = await db
    .select()
    .from(marketLayoutSnapshots)
    .where(eq(marketLayoutSnapshots.surface, "market"))
    .orderBy(desc(marketLayoutSnapshots.updatedAt))
    .limit(1);

  if (!snapshot) return null;
  return {
    id: snapshot.id,
    updatedAt: new Date(snapshot.updatedAt),
    payload: snapshot.payload,
  };
}

async function persistMarketLayoutSnapshot(
  snapshotId: string | null,
  sections: HomepageSection[]
): Promise<void> {
  const db = getDatabase();
  if (snapshotId) {
    await db
      .update(marketLayoutSnapshots)
      .set({ payload: { sections }, updatedAt: new Date() })
      .where(eq(marketLayoutSnapshots.id, snapshotId));
    return;
  }

  await db.insert(marketLayoutSnapshots).values({
    surface: "market",
    payload: { sections },
  });
}

async function resolveLiveSectionsBounded(
  resolveLiveSections: () => Promise<HomepageSection[]>,
  liveTimeoutMs: number
): Promise<BoundedSectionsResult> {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      resolveLiveSections().then((sections) => ({
        sections,
        timedOut: false,
      })),
      new Promise<BoundedSectionsResult>((resolve) => {
        timeoutId = setTimeout(
          () =>
            resolve({
              sections: [],
              timedOut: true,
            }),
          liveTimeoutMs
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function getMarketLayoutSections(
  deps: MarketLayoutSectionsDeps = {}
): Promise<HomepageSection[]> {
  const readSnapshot = deps.readSnapshot ?? readLatestMarketLayoutSnapshot;
  const persistSnapshot = deps.persistSnapshot ?? persistMarketLayoutSnapshot;
  const resolveLiveSections = deps.resolveLiveSections ?? (() => resolveMarketSections(false));
  const nowMs = deps.nowMs ?? Date.now;
  const snapshotTtlMs = deps.snapshotTtlMs ?? MARKET_LAYOUT_SNAPSHOT_TTL_MS;
  const liveTimeoutMs = deps.liveTimeoutMs ?? MARKET_LAYOUT_LIVE_TIMEOUT_MS;

  const snapshot = await readSnapshot();
  const snapshotSections = snapshot
    ? extractMarketLayoutSnapshotSections(snapshot.payload)
    : [];

  if (
    snapshot &&
    isMarketLayoutSnapshotFresh(snapshot.updatedAt, nowMs(), snapshotTtlMs)
  ) {
    return snapshotSections;
  }

  try {
    const live = await resolveLiveSectionsBounded(resolveLiveSections, liveTimeoutMs);
    if (live.timedOut) {
      if (snapshot) {
        console.warn("[Market Layout] Live resolution timed out — using snapshot fallback");
        return snapshotSections;
      }
      return [];
    }

    await persistSnapshot(snapshot?.id ?? null, live.sections);
    return live.sections;
  } catch (error) {
    if (snapshot) {
      console.warn("[Market Layout] Live resolution failed — using snapshot fallback", error);
      return snapshotSections;
    }
    console.error("[Market Layout] Failed to resolve live sections", error);
    return [];
  }
}
