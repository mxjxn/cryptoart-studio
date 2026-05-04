import { NextResponse } from "next/server";
import { getRedesignTieredSections } from "~/lib/server/homepage-layout";

/** Homepage tier-1 runs subgraph + per-token metadata enrichment. */
export const maxDuration = 60;

export async function GET() {
  const startedAt = Date.now();
  try {
    const sections = await getRedesignTieredSections();
    const elapsed = Date.now() - startedAt;
    console.log(`[API /redesign/sections] success in ${elapsed}ms`);
    return NextResponse.json(
      { success: true, sections, timingMs: elapsed },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[API /redesign/sections] Failed:", error);
    const elapsed = Date.now() - startedAt;
    return NextResponse.json(
      {
        success: false,
        sections: {
          featured: { hero: null, artworks: [] },
          kismetLots: [],
          kismetFullListings: undefined,
        },
        timingMs: elapsed,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  }
}
