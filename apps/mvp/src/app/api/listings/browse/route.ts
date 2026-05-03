import { NextRequest } from "next/server";
import { browseListings, browseListingsStreaming } from "~/lib/server/browse-listings";
import { emitRouteMetric } from "~/lib/server/route-metrics";

const BROWSE_API_TIMEOUT_MS = 7000;
/** Hard cap for streaming responses so clients never hang if subgraph/enrichment stalls */
const BROWSE_STREAM_MAX_MS = 25_000;
const BROWSE_LKG_TTL_MS = 10 * 60 * 1000;
let browseTimeoutCount = 0;
let browseDegradedCount = 0;

type BrowsePayload = {
  success: true;
  listings: unknown[];
  count: number;
  subgraphDown: boolean;
  degraded?: boolean;
  fallbackMode?: string;
  error?: string;
  pagination: {
    first: number;
    skip: number;
    hasMore: boolean;
  };
};

const browseLastKnownGood = new Map<string, { payload: BrowsePayload; cachedAt: number }>();

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
  try {
    const { searchParams } = new URL(req.url);
    const first = parseInt(searchParams.get("first") || "20");
    const skip = parseInt(searchParams.get("skip") || "0");
    const enrich = searchParams.get("enrich") !== "false";
    const noCache = searchParams.get("noCache") === "true";
    const stream = searchParams.get("stream") === "true"; // Enable streaming mode
    
    // Default order by listingId descending (newest first)
    const orderBy = searchParams.get("orderBy") || "listingId";
    const orderDirection = (searchParams.get("orderDirection") || "desc") as "asc" | "desc";
    const effectiveBrowseTimeoutMs = getDevTimeoutOverride(searchParams, "__testTimeoutMs", BROWSE_API_TIMEOUT_MS);
    const effectiveFallbackTimeoutMs = getDevTimeoutOverride(searchParams, "__testFallbackTimeoutMs", 5000);
    const lkgKey = JSON.stringify({ first, skip, orderBy, orderDirection, stream, enrich });
    
    console.log('[API /listings/browse] Request:', { first, skip, orderBy, orderDirection, enrich, stream });

    // Enriched browse (IPFS/metadata) stays short-TTL. Subgraph-only responses can CDN-cache for a day.
    const cacheHeaders: Record<string, string> = noCache
      ? {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        }
      : enrich
        ? {
            "Cache-Control":
              "public, s-maxage=300, stale-while-revalidate=120",
          }
        : {
            "Cache-Control":
              "public, s-maxage=86400, stale-while-revalidate=86400",
          };

    // If streaming is enabled, use streaming response
    if (stream && enrich) {
      const streamResponse = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          let closed = false;
          const safeEnqueue = (chunk: string) => {
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch {
              /* client disconnected or controller already closed */
            }
          };
          const safeClose = () => {
            if (closed) return;
            closed = true;
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          };

          let maxMs = BROWSE_STREAM_MAX_MS;
          if (process.env.NODE_ENV !== "production") {
            const raw = new URL(req.url).searchParams.get("__streamMaxMs");
            const parsed = raw ? Number(raw) : NaN;
            if (Number.isFinite(parsed) && parsed > 0) {
              maxMs = Math.min(Math.floor(parsed), 120_000);
            }
          }

          try {
            // Send initial JSON structure
            safeEnqueue('{"success":true,"listings":[');

            let firstItem = true;
            let count = 0;
            let subgraphReturnedFullCount = false;
            let subgraphDown = false;

            const finishBody = () => {
              if (closed) return;
              const hasMore = count === first && subgraphReturnedFullCount;
              safeEnqueue(
                `],"count":${count},"subgraphDown":${subgraphDown},"degraded":false,"pagination":{"first":${first},"skip":${skip},"hasMore":${hasMore}}}`
              );
              safeClose();
            };

            const finishBodyDegraded = () => {
              if (closed) return;
              const hasMore = count === first && subgraphReturnedFullCount;
              safeEnqueue(
                `],"count":${count},"subgraphDown":true,"degraded":true,"pagination":{"first":${first},"skip":${skip},"hasMore":${hasMore}}}`
              );
              safeClose();
            };

            const wallTimer = setTimeout(() => {
              console.warn("[API /listings/browse] Streaming wall timeout — closing partial response", {
                maxMs,
                count,
              });
              finishBodyDegraded();
            }, maxMs);

            try {
              // Stream listings as they're enriched
              for await (const listing of browseListingsStreaming({
                first,
                skip,
                orderBy,
                orderDirection,
                enrich: true,
              })) {
                if (closed) break;
                if (listing.type === 'listing') {
                  if (!firstItem) {
                    safeEnqueue(',');
                  }
                  firstItem = false;
                  safeEnqueue(JSON.stringify(listing.data));
                  count++;
                } else if (listing.type === 'metadata') {
                  subgraphReturnedFullCount =
                    listing.subgraphReturnedFullCount ?? subgraphReturnedFullCount;
                  subgraphDown = listing.subgraphDown ?? subgraphDown;
                }
              }

              clearTimeout(wallTimer);
              if (!closed) {
                finishBody();
              }
            } catch (loopErr) {
              clearTimeout(wallTimer);
              throw loopErr;
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to browse listings";
            console.error("[API /listings/browse] Streaming error:", errorMessage, error);
            safeEnqueue(
              `{"success":false,"listings":[],"count":0,"error":"${errorMessage.replace(/"/g, '\\"')}"}`
            );
            safeClose();
          }
        },
      });

      const streamHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...cacheHeaders,
      };
      
      return new Response(streamResponse, {
        headers: streamHeaders,
      });
    }

    // Non-streaming mode (original behavior)
    let result;
    const coreFallbackPromise = enrich
      ? withTimeout(
          browseListings({
            first,
            skip,
            orderBy,
            orderDirection,
            enrich: false,
          }),
          effectiveFallbackTimeoutMs,
          "browseListingsFallbackCore"
        ).then(
          (result) => ({ ok: true as const, result }),
          (error) => ({ ok: false as const, error })
        )
      : null;
    try {
      result = await withTimeout(
        browseListings({
          first,
          skip,
          orderBy,
          orderDirection,
          enrich,
        }),
        effectiveBrowseTimeoutMs,
        "browseListings"
      );
    } catch (error) {
      const timeoutMessage = error instanceof Error ? error.message : "browseListings timeout";
      browseTimeoutCount += 1;
      browseDegradedCount += 1;
      if (coreFallbackPromise) {
        const fallback = await coreFallbackPromise;
        if (fallback.ok) {
          const fallbackResult = fallback.result;
          emitRouteMetric({
            metric: "browse.fallback_core.success",
            route: "/api/listings/browse",
            level: "warn",
            tags: {
              enrich,
              first,
              skip,
              listingsCount: fallbackResult.listings.length,
            },
          });
          const fallbackPayload: BrowsePayload = {
            success: true,
            listings: fallbackResult.listings,
            count: fallbackResult.listings.length,
            subgraphDown: fallbackResult.subgraphDown || true,
            degraded: true,
            fallbackMode: "core-subgraph-only",
            error: timeoutMessage,
            pagination: {
              first,
              skip,
              hasMore: false,
            },
          };
          browseLastKnownGood.set(lkgKey, {
            payload: fallbackPayload,
            cachedAt: Date.now(),
          });
          return new Response(JSON.stringify(fallbackPayload), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Route-Degraded": "true",
              ...cacheHeaders,
            },
          });
        } else {
          const fallbackError = fallback.error;
          emitRouteMetric({
            metric: "browse.fallback_core.failure",
            route: "/api/listings/browse",
            level: "warn",
            tags: {
              reason: fallbackError instanceof Error ? fallbackError.message : "unknown",
            },
          });
        }
      }
      const lastKnown = browseLastKnownGood.get(lkgKey);
      if (lastKnown && Date.now() - lastKnown.cachedAt <= BROWSE_LKG_TTL_MS) {
        emitRouteMetric({
          metric: "browse.fallback_lkg.success",
          route: "/api/listings/browse",
          level: "warn",
          tags: {
            ageMs: Date.now() - lastKnown.cachedAt,
            listingsCount: lastKnown.payload.count,
          },
        });
        return new Response(JSON.stringify({
          ...lastKnown.payload,
          degraded: true,
          fallbackMode: "last-known-good",
          subgraphDown: true,
          error: timeoutMessage,
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Route-Degraded": "true",
            "X-Route-Fallback": "lkg",
            ...cacheHeaders,
          },
        });
      }
      emitRouteMetric({
        metric: "browse.timeout",
        route: "/api/listings/browse",
        level: "warn",
        tags: {
          timeoutMs: BROWSE_API_TIMEOUT_MS,
          effectiveTimeoutMs: effectiveBrowseTimeoutMs,
          effectiveFallbackTimeoutMs,
          enrich,
          stream,
          first,
          skip,
          browseTimeoutCount,
          browseDegradedCount,
        },
      });
      console.warn("[API /listings/browse] Returning degraded response:", timeoutMessage);
      console.warn("[API /listings/browse] Degraded counters", {
        browseTimeoutCount,
        browseDegradedCount,
        timeoutMs: BROWSE_API_TIMEOUT_MS,
      });
      const degradedPayload: BrowsePayload = {
        success: true,
        listings: [],
        count: 0,
        subgraphDown: true,
        degraded: true,
        error: timeoutMessage,
        pagination: {
          first,
          skip,
          hasMore: false,
        },
      };
      browseLastKnownGood.set(lkgKey, {
        payload: degradedPayload,
        cachedAt: Date.now(),
      });
      return new Response(JSON.stringify(degradedPayload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Route-Degraded": "true",
          ...cacheHeaders,
        },
      });
    }
    
    console.log('[API /listings/browse] Result:', { listingsCount: result.listings.length, subgraphReturnedFullCount: result.subgraphReturnedFullCount });

    const enrichedListings = result.listings;
    const hasMore = enrichedListings.length === first && result.subgraphReturnedFullCount;
    
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...cacheHeaders,
    };
    const payload: BrowsePayload = {
      success: true,
      listings: enrichedListings,
      count: enrichedListings.length,
      subgraphDown: result.subgraphDown || false,
      pagination: {
        first,
        skip,
        hasMore,
      },
    };
    browseLastKnownGood.set(lkgKey, {
      payload,
      cachedAt: Date.now(),
    });

    return new Response(JSON.stringify(payload), {
      headers: responseHeaders,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to browse listings";
    console.error("[API /listings/browse] Error:", errorMessage, error);
    
    return new Response(JSON.stringify({
      success: false,
      listings: [],
      count: 0,
      error: errorMessage,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

