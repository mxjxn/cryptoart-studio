import { NextRequest } from "next/server";
import { browseListingsStreaming } from "~/lib/server/browse-listings";

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
    
    console.log('[API /listings/browse] Request:', { first, skip, orderBy, orderDirection, enrich, stream });

    // Use no-cache headers if noCache param is set (for admin revalidation)
    // Otherwise use smart caching: 5 minute edge cache with stale-while-revalidate
    const cacheHeaders: Record<string, string> = noCache
      ? { 
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      : {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=120',
        };

    // If streaming is enabled, use streaming response
    if (stream && enrich) {
      const streamResponse = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
          try {
            // Send initial JSON structure
            controller.enqueue(encoder.encode('{"success":true,"listings":['));
            
            let firstItem = true;
            let count = 0;
            let subgraphReturnedFullCount = false;
            let subgraphDown = false;
            
            // Stream listings as they're enriched
            for await (const listing of browseListingsStreaming({
              first,
              skip,
              orderBy,
              orderDirection,
              enrich: true,
            })) {
              if (listing.type === 'listing') {
                // Send listing as JSON
                if (!firstItem) {
                  controller.enqueue(encoder.encode(','));
                }
                firstItem = false;
                controller.enqueue(encoder.encode(JSON.stringify(listing.data)));
                count++;
              } else if (listing.type === 'metadata') {
                // Update metadata
                subgraphReturnedFullCount = listing.subgraphReturnedFullCount ?? subgraphReturnedFullCount;
                subgraphDown = listing.subgraphDown ?? subgraphDown;
              }
            }
            
            // Close listings array and add metadata
            const hasMore = count === first && subgraphReturnedFullCount;
            controller.enqueue(encoder.encode(`],"count":${count},"subgraphDown":${subgraphDown},"pagination":{"first":${first},"skip":${skip},"hasMore":${hasMore}}}`));
            controller.close();
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to browse listings";
            console.error("[API /listings/browse] Streaming error:", errorMessage, error);
            controller.enqueue(encoder.encode(`{"success":false,"listings":[],"count":0,"error":"${errorMessage.replace(/"/g, '\\"')}"}`));
            controller.close();
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
    const result = await browseListings({
      first,
      skip,
      orderBy,
      orderDirection,
      enrich,
    });
    
    console.log('[API /listings/browse] Result:', { listingsCount: result.listings.length, subgraphReturnedFullCount: result.subgraphReturnedFullCount });

    const enrichedListings = result.listings;
    const hasMore = enrichedListings.length === first && result.subgraphReturnedFullCount;
    
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...cacheHeaders,
    };
    
    return new Response(JSON.stringify({
      success: true,
      listings: enrichedListings,
      count: enrichedListings.length,
      subgraphDown: result.subgraphDown || false,
      pagination: {
        first,
        skip,
        hasMore,
      },
    }), {
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

