import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMarketLayoutSections,
  isMarketLayoutSnapshotFresh,
  MARKET_LAYOUT_SNAPSHOT_TTL_MS,
} from "./market-layout-snapshot";

const NOW = new Date("2026-08-18T11:00:00.000Z").getTime();

function makeSection(id: string) {
  return {
    id,
    sectionType: "recent_listings" as const,
    title: id,
    description: null,
    config: null,
    displayOrder: 0,
    isActive: true,
    listings: [],
  };
}

describe("isMarketLayoutSnapshotFresh", () => {
  it("treats snapshots within the ttl as fresh", () => {
    assert.equal(
      isMarketLayoutSnapshotFresh(
        new Date(NOW - MARKET_LAYOUT_SNAPSHOT_TTL_MS + 1),
        NOW,
        MARKET_LAYOUT_SNAPSHOT_TTL_MS
      ),
      true
    );
  });

  it("treats older snapshots as stale", () => {
    assert.equal(
      isMarketLayoutSnapshotFresh(
        new Date(NOW - MARKET_LAYOUT_SNAPSHOT_TTL_MS - 1),
        NOW,
        MARKET_LAYOUT_SNAPSHOT_TTL_MS
      ),
      false
    );
  });
});

describe("getMarketLayoutSections", () => {
  it("returns a fresh snapshot without resolving live data", async () => {
    let liveCalls = 0;
    const sections = await getMarketLayoutSections({
      nowMs: () => NOW,
      readSnapshot: async () => ({
        id: "snapshot-1",
        updatedAt: new Date(NOW - 5_000),
        payload: { sections: [makeSection("snapshot")] },
      }),
      resolveLiveSections: async () => {
        liveCalls += 1;
        return [makeSection("live")];
      },
      persistSnapshot: async () => {},
    });

    assert.equal(liveCalls, 0);
    assert.deepEqual(sections.map((section) => section.id), ["snapshot"]);
  });

  it("refreshes stale snapshots with live data and persists the result", async () => {
    const persisted: Array<{ snapshotId: string | null; sections: string[] }> = [];

    const sections = await getMarketLayoutSections({
      nowMs: () => NOW,
      readSnapshot: async () => ({
        id: "snapshot-2",
        updatedAt: new Date(NOW - MARKET_LAYOUT_SNAPSHOT_TTL_MS - 1),
        payload: { sections: [makeSection("stale")] },
      }),
      resolveLiveSections: async () => [makeSection("fresh")],
      persistSnapshot: async (snapshotId, nextSections) => {
        persisted.push({
          snapshotId,
          sections: nextSections.map((section) => section.id),
        });
      },
    });

    assert.deepEqual(sections.map((section) => section.id), ["fresh"]);
    assert.deepEqual(persisted, [
      {
        snapshotId: "snapshot-2",
        sections: ["fresh"],
      },
    ]);
  });

  it("falls back to a stale snapshot when live resolution times out", async () => {
    let persisted = false;

    const sections = await getMarketLayoutSections({
      nowMs: () => NOW,
      snapshotTtlMs: 1,
      liveTimeoutMs: 10,
      readSnapshot: async () => ({
        id: "snapshot-3",
        updatedAt: new Date(NOW - 5_000),
        payload: { sections: [makeSection("stale")] },
      }),
      resolveLiveSections: async () =>
        await new Promise((resolve) => setTimeout(() => resolve([makeSection("fresh")]), 50)),
      persistSnapshot: async () => {
        persisted = true;
      },
    });

    assert.equal(persisted, false);
    assert.deepEqual(sections.map((section) => section.id), ["stale"]);
  });
});
