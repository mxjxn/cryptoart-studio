import { NextRequest, NextResponse } from 'next/server';
import type { EnrichedAuctionData } from '~/lib/types';
import { getCachedActiveAuctions, fetchActiveAuctionsUncached } from '~/lib/server/auction';
import { emitRouteMetric } from '~/lib/server/route-metrics';

const ACTIVE_AUCTIONS_TIMEOUT_MS = 7000;
const ACTIVE_AUCTIONS_LKG_TTL_MS = 10 * 60 * 1000;
let activeAuctionsTimeoutCount = 0;
let activeAuctionsDegradedCount = 0;

type ActiveAuctionsPayload = {
  success: true;
  auctions: EnrichedAuctionData[];
  count: number;
  cached: boolean;
  degraded?: boolean;
  fallbackMode?: string;
  error?: string;
};

const activeAuctionsLastKnownGood = new Map<string, { payload: ActiveAuctionsPayload; cachedAt: number }>();

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function getDevTimeoutOverride(searchParams: URLSearchParams, key: string, fallback: number): number {
  if (process.env.NODE_ENV === "production") return fallback;
  const raw = searchParams.get(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function GET(req: NextRequest) {
  let first = 16;
  let skip = 0;
  let enrich = true;
  let useCache = true;
  let lkgKey = "";
  let effectiveActiveTimeoutMs = ACTIVE_AUCTIONS_TIMEOUT_MS;
  let effectiveFallbackTimeoutMs = 5000;
  let coreFallbackPromise:
    | Promise<
        | { ok: true; result: EnrichedAuctionData[] }
        | { ok: false; error: unknown }
      >
    | null = null;
  try {
    const { searchParams } = new URL(req.url);
    first = parseInt(searchParams.get('first') || '16'); // Default to 16 for homepage
    skip = parseInt(searchParams.get('skip') || '0');
    enrich = searchParams.get('enrich') !== 'false'; // Default to true
    useCache = searchParams.get('cache') !== 'false'; // Default to true
    effectiveActiveTimeoutMs = getDevTimeoutOverride(searchParams, "__testTimeoutMs", ACTIVE_AUCTIONS_TIMEOUT_MS);
    effectiveFallbackTimeoutMs = getDevTimeoutOverride(searchParams, "__testFallbackTimeoutMs", 5000);
    lkgKey = JSON.stringify({ first, skip, enrich, useCache });

    console.log('[API /auctions/active] Request:', { first, skip, enrich, useCache });

    let enrichedAuctions: EnrichedAuctionData[];
    coreFallbackPromise = enrich
      ? withTimeout(
          useCache
            ? getCachedActiveAuctions(first, skip, false)
            : fetchActiveAuctionsUncached(first, skip, false),
          effectiveFallbackTimeoutMs,
          "activeAuctionsFallbackCore"
        ).then(
          (result) => ({ ok: true as const, result }),
          (error) => ({ ok: false as const, error })
        )
      : null;
    
    if (useCache) {
      // Use cached data for faster response
      console.log('[API /auctions/active] Using cached data');
      enrichedAuctions = await withTimeout(
        getCachedActiveAuctions(first, skip, enrich),
        effectiveActiveTimeoutMs,
        "getCachedActiveAuctions"
      );
    } else {
      // Bypass cache for fresh data (e.g., when client polls for updates)
      console.log('[API /auctions/active] Fetching fresh data');
      enrichedAuctions = await withTimeout(
        fetchActiveAuctionsUncached(first, skip, enrich),
        effectiveActiveTimeoutMs,
        "fetchActiveAuctionsUncached"
      );
    }

    console.log('[API /auctions/active] Returning', enrichedAuctions.length, 'auctions');

    const payload: ActiveAuctionsPayload = {
      success: true,
      auctions: enrichedAuctions,
      count: enrichedAuctions.length,
      cached: useCache,
    };
    activeAuctionsLastKnownGood.set(lkgKey, {
      payload,
      cachedAt: Date.now(),
    });
    const response = NextResponse.json(payload);

    // Add HTTP cache headers for CDN/edge caching
    // Cache for 30 seconds, allow stale for 60 seconds while revalidating
    // This dramatically reduces disk IO by serving cached responses from the edge
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=60'
    );

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch active auctions';
    activeAuctionsTimeoutCount += 1;
    activeAuctionsDegradedCount += 1;
    if (coreFallbackPromise) {
      const fallback = await coreFallbackPromise;
      if (fallback.ok) {
        const fallbackAuctions = fallback.result;
        emitRouteMetric({
          metric: "active_auctions.fallback_core.success",
          route: "/api/auctions/active",
          level: "warn",
          tags: {
            enrich,
            useCache,
            first,
            skip,
            auctionsCount: fallbackAuctions.length,
          },
        });
        const fallbackPayload: ActiveAuctionsPayload = {
          success: true,
          auctions: fallbackAuctions,
          count: fallbackAuctions.length,
          cached: useCache,
          degraded: true,
          fallbackMode: "core-subgraph-only",
          error: errorMessage,
        };
        activeAuctionsLastKnownGood.set(lkgKey, {
          payload: fallbackPayload,
          cachedAt: Date.now(),
        });
        const fallbackResponse = NextResponse.json(fallbackPayload, { status: 200 });
        fallbackResponse.headers.set("X-Route-Degraded", "true");
        return fallbackResponse;
      } else {
        const fallbackError = fallback.error;
        emitRouteMetric({
          metric: "active_auctions.fallback_core.failure",
          route: "/api/auctions/active",
          level: "warn",
          tags: {
            reason: fallbackError instanceof Error ? fallbackError.message : "unknown",
          },
        });
      }
    }
    const lastKnown = activeAuctionsLastKnownGood.get(lkgKey);
    if (lastKnown && Date.now() - lastKnown.cachedAt <= ACTIVE_AUCTIONS_LKG_TTL_MS) {
      emitRouteMetric({
        metric: "active_auctions.fallback_lkg.success",
        route: "/api/auctions/active",
        level: "warn",
        tags: {
          ageMs: Date.now() - lastKnown.cachedAt,
          auctionsCount: lastKnown.payload.count,
        },
      });
      const lkgResponse = NextResponse.json(
        {
          ...lastKnown.payload,
          degraded: true,
          fallbackMode: "last-known-good",
          error: errorMessage,
        },
        { status: 200 }
      );
      lkgResponse.headers.set("X-Route-Degraded", "true");
      lkgResponse.headers.set("X-Route-Fallback", "lkg");
      return lkgResponse;
    }
    emitRouteMetric({
      metric: "active_auctions.timeout",
      route: "/api/auctions/active",
      level: "warn",
      tags: {
        timeoutMs: ACTIVE_AUCTIONS_TIMEOUT_MS,
        effectiveTimeoutMs: effectiveActiveTimeoutMs,
        effectiveFallbackTimeoutMs,
        activeAuctionsTimeoutCount,
        activeAuctionsDegradedCount,
      },
    });
    console.error('[API /auctions/active] Error:', errorMessage, error);
    console.warn('[API /auctions/active] Degraded counters', {
      activeAuctionsTimeoutCount,
      activeAuctionsDegradedCount,
      timeoutMs: ACTIVE_AUCTIONS_TIMEOUT_MS,
    });
    
    const degradedPayload: ActiveAuctionsPayload = {
      success: true,
      auctions: [],
      count: 0,
      cached: useCache,
      degraded: true,
      error: errorMessage,
    };
    activeAuctionsLastKnownGood.set(lkgKey, {
      payload: degradedPayload,
      cachedAt: Date.now(),
    });
    const degradedResponse = NextResponse.json(degradedPayload, { status: 200 }); // Return 200 so client can handle gracefully
    degradedResponse.headers.set("X-Route-Degraded", "true");
    return degradedResponse;
  }
}

