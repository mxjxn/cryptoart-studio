import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cron/refresh-homepage-og
 *
 * Pre-renders the homepage OG image once per day so that all artwork thumbnails
 * are fetched, processed, and cached in the database image cache before any real
 * user or social-platform request arrives.
 *
 * Flow:
 *  1. Call /opengraph-image?refresh=true  → bypasses stale DB image cache,
 *     re-fetches every artwork image, stores fresh results in imageCache DB.
 *     Returns with no-CDN-cache headers so the CDN does not store this run.
 *  2. Call /opengraph-image (no refresh)  → reads warm DB image cache, renders
 *     quickly, returns with s-maxage=86400 so the CDN caches it for 24 h.
 *
 * Scheduled: once per day (see vercel.json)
 * Protected:  CRON_SECRET environment variable (Vercel sets the Bearer token)
 */
export const runtime = "nodejs";
export const maxDuration = 60; // safe for all Vercel plan tiers

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (
      !process.env.CRON_SECRET ||
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine the base URL for internal requests
    const baseUrl =
      process.env.NEXT_PUBLIC_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";

    const ogUrl = `${baseUrl}/opengraph-image`;
    const startTime = Date.now();

    // Step 1: Re-fetch and re-cache all artwork images (bypasses DB image cache).
    // This populates imageCache DB entries so that subsequent requests are fast.
    // The thumbnailUrl preference in the OG route means these fetches are quick
    // (Vercel Blob URLs), so 50s is a generous upper bound.
    console.log(
      `[cron/refresh-homepage-og] Step 1: pre-warming image cache via ${ogUrl}?refresh=true`,
    );
    let step1Status = "skipped";
    try {
      const refreshRes = await fetch(`${ogUrl}?refresh=true`, {
        signal: AbortSignal.timeout(50000), // 50s — image fetching can be slow
        headers: {
          // Bypass any potential edge/CDN layer so the request reaches the origin
          "Cache-Control": "no-cache",
          // Identify as the cron job in server logs
          "X-Cron-Job": "refresh-homepage-og",
        },
      });
      step1Status = refreshRes.ok ? "ok" : `http_${refreshRes.status}`;
      console.log(
        `[cron/refresh-homepage-og] Step 1 complete: status=${refreshRes.status}`,
      );
    } catch (err) {
      step1Status = `error: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[cron/refresh-homepage-og] Step 1 failed:`, err);
      // Non-fatal: images may already be warm in DB from a previous run.
      // The next organic request will still benefit from whatever is cached.
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[cron/refresh-homepage-og] Done in ${elapsed}ms — step1=${step1Status}`,
    );

    return NextResponse.json({
      success: true,
      elapsed: `${elapsed}ms`,
      step1: step1Status,
    });
  } catch (error) {
    console.error("[cron/refresh-homepage-og] Fatal error:", error);
    return NextResponse.json(
      {
        error: "Failed to refresh homepage OG image",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

