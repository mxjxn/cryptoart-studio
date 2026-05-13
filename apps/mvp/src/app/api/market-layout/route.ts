import { NextResponse } from "next/server";
import { resolveMarketSections } from "~/lib/server/homepage-layout";
import { withTimeout } from "~/lib/utils";

export const maxDuration = 30;

/** ISR: market rails refresh periodically; listing artwork still cached per token elsewhere. */
export const revalidate = 120;

export async function GET() {
  try {
    const sections = await withTimeout(resolveMarketSections(false), 25_000, []);
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
