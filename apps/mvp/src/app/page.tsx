import { Metadata } from "next";
import { APP_NAME, APP_DESCRIPTION, APP_URL } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import type { EnrichedAuctionData } from "~/lib/types";
import HomePageClient from "./HomePageClient";
import { browseListings } from "~/lib/server/browse-listings";

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
  // Fetch recent listings server-side with thumbnails for ISR (Incremental Static Regeneration)
  // This allows the homepage to be statically generated with optimized images
  // The page will be cached and served instantly, then revalidated every 60 seconds
  let initialAuctions: EnrichedAuctionData[] = [];
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  // In development, skip server-side fetch if database is slow (set ENABLE_SERVER_FETCH=true to enable)
  const enableServerFetch = !isDevelopment || process.env.ENABLE_SERVER_FETCH === 'true';
  
  if (enableServerFetch) {
    try {
      // Longer timeout for ISR build - we want complete data for static generation
      // In production, this runs during build/revalidation, not on every request
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Server-side fetch timeout')), 5000); // 5 second timeout
      });
      
      const listingsPromise = browseListings({
        first: 20,
        skip: 0,
        orderBy: "createdAt",
        orderDirection: "desc",
        enrich: true,
      });
      
      const result = await Promise.race([listingsPromise, timeoutPromise]);
      initialAuctions = result.listings;
    } catch (error) {
      // Silently fail in development - client will fetch
      if (!isDevelopment) {
        console.error("[Homepage] Error fetching listings:", error);
      }
      // Continue with empty array - client will handle fetching
      // This prevents the page from hanging if database is unavailable
    }
  }

  return <HomePageClient initialAuctions={initialAuctions} />;
}

