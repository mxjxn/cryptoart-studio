import { NextRequest, NextResponse } from "next/server";
import { getAuctionServer } from "~/lib/server/auction";
import { prepareAuctionOGImageData } from "~/lib/og-image-generator";

/**
 * Pre-warm OpenGraph image cache for an auction
 * 
 * This endpoint can be called when an auction is created to pre-generate
 * and cache the OpenGraph image. Can be triggered by:
 * - Subgraph webhook on auction creation
 * - Transaction event handler
 * - Cron job
 * - Manual trigger
 * 
 * POST /api/auctions/[listingId]/warm-og-cache
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;

    if (!listingId) {
      return NextResponse.json(
        { success: false, error: "Listing ID is required" },
        { status: 400 }
      );
    }

    // Fetch auction data
    const auction = await getAuctionServer(listingId);

    if (!auction) {
      return NextResponse.json(
        { success: false, error: "Auction not found" },
        { status: 404 }
      );
    }

    // Prepare image data (this will fetch contract name, artist name, etc.)
    // and trigger image generation via the opengraph-image route
    // The actual image generation happens when the route is accessed,
    // but preparing the data helps warm the cache
    try {
      await prepareAuctionOGImageData(auction);

      // Optionally: Trigger actual image generation by fetching the OG image URL
      // This ensures the image is cached by the CDN
      const baseUrl =
        process.env.NEXT_PUBLIC_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";

      const ogImageUrl = `${baseUrl}/listing/${listingId}/opengraph-image`;

      try {
        // Fetch the OG image to trigger generation and cache it
        const response = await fetch(ogImageUrl, {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache", // Don't use cached version, force generation
          },
        });

        if (response.ok) {
          return NextResponse.json({
            success: true,
            message: "OpenGraph image cache warmed successfully",
            listingId,
            ogImageUrl,
          });
        } else {
          console.warn(
            `Failed to generate OG image: ${response.status} ${response.statusText}`
          );
          return NextResponse.json(
            {
              success: false,
              error: "Failed to generate OpenGraph image",
              listingId,
            },
            { status: 500 }
          );
        }
      } catch (fetchError) {
        console.error("Error fetching OG image for cache warming:", fetchError);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to fetch OpenGraph image",
            listingId,
          },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error("Error preparing OG image data:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to prepare image data",
          listingId,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in warm-og-cache endpoint:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

