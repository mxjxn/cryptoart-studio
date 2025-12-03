import { Metadata } from "next";
import { APP_NAME, APP_URL } from "~/lib/constants";
import { getMiniAppEmbedMetadata, normalizeUrl } from "~/lib/utils";
import AuctionDetailClient from "./AuctionDetailClient";

interface ListingPageProps {
  params: Promise<{ listingId: string }>;
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { listingId } = await params;
  
  // Construct absolute URLs for embed metadata (normalize to prevent double slashes)
  // Farcaster requires absolute URLs for imageUrl and action.url
  const listingImageUrl = normalizeUrl(APP_URL, `/listing/${listingId}/opengraph-image`);
  const listingPageUrl = normalizeUrl(APP_URL, `/listing/${listingId}`);

  console.log(`[OG Image] [generateMetadata] Generating metadata for listing ${listingId}`);
  console.log(`[OG Image] [generateMetadata] Image URL: ${listingImageUrl}`);
  console.log(`[OG Image] [generateMetadata] Page URL: ${listingPageUrl}`);

  const title = `Listing #${listingId} | ${APP_NAME}`;
  const description = "View listing details and place bids";

  // Use the listing-specific OpenGraph image as the splash screen
  // This shows the listing details when the mini app launches
  const miniappMetadata = getMiniAppEmbedMetadata(
    listingImageUrl, // imageUrl for the embed card
    listingPageUrl,  // action.url where button navigates
    false,           // use launch_miniapp type
    listingImageUrl, // splashImageUrl - use listing-specific image
    "View Listing"   // buttonText - custom text for listing pages
  );
  const frameMetadata = getMiniAppEmbedMetadata(
    listingImageUrl,
    listingPageUrl,
    true,            // use launch_frame type for backward compatibility
    listingImageUrl, // splashImageUrl - use listing-specific image
    "View Listing"   // buttonText - custom text for listing pages
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
          url: listingImageUrl,
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

export default async function ListingPage({ params }: ListingPageProps) {
  const { listingId } = await params;
  return <AuctionDetailClient listingId={listingId} />;
}

