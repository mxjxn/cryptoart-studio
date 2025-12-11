import { NextRequest, NextResponse } from "next/server";
import { browseListings } from "~/lib/server/browse-listings";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const first = parseInt(searchParams.get("first") || "20");
    const skip = parseInt(searchParams.get("skip") || "0");
    const enrich = searchParams.get("enrich") !== "false";
    const noCache = searchParams.get("noCache") === "true";
    
    // Default order by listingId descending (newest first)
    const orderBy = searchParams.get("orderBy") || "listingId";
    const orderDirection = (searchParams.get("orderDirection") || "desc") as "asc" | "desc";
    
    console.log('[API /listings/browse] Request:', { first, skip, orderBy, orderDirection, enrich });
    
    const result = await browseListings({
      first,
      skip,
      orderBy,
      orderDirection,
      enrich,
    });
    
    console.log('[API /listings/browse] Result:', { listingsCount: result.listings.length, subgraphReturnedFullCount: result.subgraphReturnedFullCount });

    const enrichedListings = result.listings;

    // Use no-cache headers if noCache param is set (for admin revalidation)
    const cacheHeaders = noCache
      ? { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' }
      : {
          // Add HTTP cache headers for CDN/edge caching
          // Cache for 30 seconds, allow stale for 60 seconds while revalidating
          // This dramatically reduces disk IO by serving cached responses from the edge
          // Note: This cache can be invalidated via revalidatePath('/api/listings/browse')
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        };

    // Determine if there are more listings available
    // If we got exactly the requested amount AND the subgraph returned the full amount we requested,
    // then there might be more listings available.
    // If we got fewer than requested OR the subgraph didn't return the full amount, we've exhausted the listings.
    const hasMore = enrichedListings.length === first && result.subgraphReturnedFullCount;
    
    return NextResponse.json({
      success: true,
      listings: enrichedListings,
      count: enrichedListings.length,
      subgraphDown: result.subgraphDown || false,
      pagination: {
        first,
        skip,
        hasMore,
      },
    }, {
      headers: cacheHeaders,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to browse listings";
    console.error("[API /listings/browse] Error:", errorMessage, error);
    
    return NextResponse.json(
      {
        success: false,
        listings: [],
        count: 0,
        error: errorMessage,
      },
      { status: 200 } // Return 200 so client can handle gracefully
    );
  }
}

