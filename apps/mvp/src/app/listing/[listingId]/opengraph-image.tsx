import { ImageResponse } from "next/og";
import { getAuctionServer } from "~/lib/server/auction";
import {
  prepareAuctionOGImageData,
  getAuctionOGImageJSX,
} from "~/lib/og-image-generator";

export const alt = "Listing";
// Farcaster Mini App embeds require 3:2 aspect ratio
// See: https://miniapps.farcaster.xyz/docs/guides/sharing
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const startTime = Date.now();
  const { listingId } = await params;
  
  console.log(`[OG Image] GET /listing/${listingId}/opengraph-image - Request received`);
  console.log(`[OG Image] Listing ID: ${listingId}`);
  
  const auction = await getAuctionServer(listingId);

  if (!auction) {
    console.warn(`[OG Image] Listing ${listingId} not found - returning fallback image`);
    return new ImageResponse(
      (
        <div
          tw="flex flex-col items-center justify-center w-full h-full text-6xl text-white font-bold"
          style={{
            background: "linear-gradient(to bottom right, #8b5cf6, #6366f1)",
          }}
        >
          <div>Listing Not Found</div>
        </div>
      ),
      {
        ...size,
        headers: {
          // Farcaster recommends immutable, no-transform for dynamic images
          // See: https://miniapps.farcaster.xyz/docs/guides/sharing
          "Cache-Control": "public, immutable, no-transform, max-age=3600, s-maxage=3600",
        },
      }
    );
  }

  try {
    console.log(`[OG Image] Listing found: tokenAddress=${auction.tokenAddress}, tokenId=${auction.tokenId}`);
    
    // Prepare image data
    console.log(`[OG Image] Preparing image data...`);
    const imageData = await prepareAuctionOGImageData(auction);
    console.log(`[OG Image] Image data prepared:`, {
      title: imageData.title,
      collectionName: imageData.collectionName,
      artistName: imageData.artistName,
      priceLabel: imageData.priceLabel,
      price: imageData.price,
      timeText: imageData.timeText,
      hasImageUrl: !!imageData.imageUrl,
      imageUrl: imageData.imageUrl?.substring(0, 100) + (imageData.imageUrl && imageData.imageUrl.length > 100 ? '...' : ''),
    });

    // Generate JSX for the image
    console.log(`[OG Image] Generating JSX...`);
    const imageJSX = getAuctionOGImageJSX(imageData);
    
    const elapsed = Date.now() - startTime;
    console.log(`[OG Image] Image generation complete in ${elapsed}ms`);
    console.log(`[OG Image] Returning image with size: ${size.width}x${size.height}, contentType: ${contentType}`);

    return new ImageResponse(imageJSX, {
      ...size,
      headers: {
        // Farcaster recommends immutable, no-transform for dynamic images
        // See: https://miniapps.farcaster.xyz/docs/guides/sharing
        "Cache-Control": "public, immutable, no-transform, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[OG Image] Error generating OG image for ${listingId} (${elapsed}ms):`, error);
    if (error instanceof Error) {
      console.error(`[OG Image] Error stack:`, error.stack);
    }
    // Fallback to simple gradient
    console.log(`[OG Image] Returning fallback error image`);
    return new ImageResponse(
      (
        <div
          tw="flex flex-col items-center justify-center w-full h-full text-5xl text-white font-bold"
          style={{
            background: "linear-gradient(to bottom right, #8b5cf6, #6366f1)",
          }}
        >
          <div>Listing #{listingId}</div>
        </div>
      ),
      {
        ...size,
        headers: {
          // Short cache for fallback images to prevent caching errors
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      }
    );
  }
}

