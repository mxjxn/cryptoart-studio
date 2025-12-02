import { Metadata } from "next";
import { APP_NAME, APP_URL } from "~/lib/constants";
import { getMiniAppEmbedMetadata, normalizeUrl } from "~/lib/utils";
import AuctionDetailClient from "./AuctionDetailClient";

interface AuctionPageProps {
  params: Promise<{ listingId: string }>;
}

export async function generateMetadata({ params }: AuctionPageProps): Promise<Metadata> {
  const { listingId } = await params;
  
  // Construct absolute URLs for embed metadata (normalize to prevent double slashes)
  // Farcaster requires absolute URLs for imageUrl and action.url
  const auctionImageUrl = normalizeUrl(APP_URL, `/auction/${listingId}/opengraph-image`);
  const auctionPageUrl = normalizeUrl(APP_URL, `/auction/${listingId}`);

  console.log(`[OG Image] [generateMetadata] Generating metadata for auction ${listingId}`);
  console.log(`[OG Image] [generateMetadata] Image URL: ${auctionImageUrl}`);
  console.log(`[OG Image] [generateMetadata] Page URL: ${auctionPageUrl}`);

  const title = `Auction #${listingId} | ${APP_NAME}`;
  const description = "View auction details and place bids";

  // Use the auction-specific OpenGraph image as the splash screen
  // This shows the auction details when the mini app launches
  const miniappMetadata = getMiniAppEmbedMetadata(
    auctionImageUrl, // imageUrl for the embed card
    auctionPageUrl,  // action.url where button navigates
    false,           // use launch_miniapp type
    auctionImageUrl  // splashImageUrl - use auction-specific image
  );
  const frameMetadata = getMiniAppEmbedMetadata(
    auctionImageUrl,
    auctionPageUrl,
    true,            // use launch_frame type for backward compatibility
    auctionImageUrl  // splashImageUrl - use auction-specific image
  );
  
  console.log(`[OG Image] [generateMetadata] MiniApp embed metadata:`, JSON.stringify(miniappMetadata, null, 2));
  console.log(`[OG Image] [generateMetadata] Frame embed metadata:`, JSON.stringify(frameMetadata, null, 2));

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: auctionImageUrl,
          width: 1200,
          height: 800, // 3:2 aspect ratio required by Farcaster
        },
      ],
    },
    other: {
      // Farcaster Mini App embed metadata
      // Follows spec: https://miniapps.farcaster.xyz/docs/guides/sharing
      "fc:miniapp": JSON.stringify(miniappMetadata),
      // For backward compatibility - use launch_frame type
      "fc:frame": JSON.stringify(frameMetadata),
    },
  };
}

export default async function AuctionPage({ params }: AuctionPageProps) {
  const { listingId } = await params;
  return <AuctionDetailClient listingId={listingId} />;
}

