import { Metadata } from "next";
import { APP_NAME, APP_DESCRIPTION, APP_URL } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import HomePageClient from "./HomePageClient";

// Enable ISR (Incremental Static Regeneration) for fast homepage rendering
// Page will be statically generated and revalidated every 60 seconds
// This allows the homepage to be served instantly from cache while staying fresh
// The cron job (every 15 minutes) provides additional revalidation when new listings appear
export const revalidate = 60; // Revalidate every 60 seconds

export async function generateMetadata(): Promise<Metadata> {
  // Use the opengraph-image route that shows recent listings with images
  // (not the /api/opengraph-image which is just text)
  const ogImageUrl = `${APP_URL}/opengraph-image`;
  const homepageUrl = APP_URL;
  
  // Create separate metadata objects for fc:miniapp and fc:frame
  // fc:frame needs useFrameType: true for backward compatibility
  const miniappMetadata = getMiniAppEmbedMetadata(
    ogImageUrl,  // imageUrl for the embed card
    homepageUrl, // action.url where button navigates
    false,        // use launch_miniapp type
    ogImageUrl,   // splashImageUrl
  );
  const frameMetadata = getMiniAppEmbedMetadata(
    ogImageUrl,
    homepageUrl,
    true,         // use launch_frame type for backward compatibility
    ogImageUrl,   // splashImageUrl
  );
  
  return {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    openGraph: {
      title: APP_NAME,
      description: APP_DESCRIPTION,
      images: [ogImageUrl],
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

export default async function Home() {
  // Client-side fetching is now handled in HomePageClient
  // The page uses ISR for fast initial render, but listings are fetched client-side
  // to support separate NFT and Edition sections with filtering
  return <HomePageClient />;
}

