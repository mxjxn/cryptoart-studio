import { NextRequest, NextResponse } from "next/server";
import { getLiveBids } from "~/lib/server/homepage-layout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const limitParam = req.nextUrl.searchParams.get("limit");
    const parsed = limitParam ? parseInt(limitParam, 10) : 4;
    const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 20) : 4;

    const listings = await getLiveBids(limit);
    const response = NextResponse.json({ success: true, listings });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (error) {
    console.error("[API /listings/live-bids] GET failed:", error);
    return NextResponse.json({ success: false, listings: [] }, { status: 500 });
  }
}
