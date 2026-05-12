import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cron/refresh-homepage-og
 *
 * Homepage `/opengraph-image` is a static Satori render (local fonts + logo only).
 * This job pings the URL so CDNs / edges see traffic and can cache the response.
 *
 * Scheduled: once per day (see vercel.json)
 * Protected:  CRON_SECRET environment variable (Vercel sets the Bearer token)
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (
      !process.env.CRON_SECRET ||
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";

    const ogUrl = `${baseUrl}/opengraph-image`;
    const startTime = Date.now();

    let pingStatus = "skipped";
    try {
      const res = await fetch(ogUrl, {
        signal: AbortSignal.timeout(15_000),
        headers: {
          "Cache-Control": "no-cache",
          "X-Cron-Job": "refresh-homepage-og",
        },
      });
      pingStatus = res.ok ? "ok" : `http_${res.status}`;
      console.log(
        `[cron/refresh-homepage-og] Ping complete: status=${res.status}`,
      );
    } catch (err) {
      pingStatus = `error: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[cron/refresh-homepage-og] Ping failed:`, err);
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[cron/refresh-homepage-og] Done in ${elapsed}ms — ping=${pingStatus}`,
    );

    return NextResponse.json({
      success: true,
      elapsed: `${elapsed}ms`,
      ping: pingStatus,
    });
  } catch (error) {
    console.error("[cron/refresh-homepage-og] Fatal error:", error);
    return NextResponse.json(
      {
        error: "Failed to ping homepage OG image",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
