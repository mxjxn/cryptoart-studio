import { Metadata } from "next";
import { APP_NAME, APP_DESCRIPTION, APP_URL } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import type { EnrichedAuctionData } from "~/lib/types";
import HomePageClient from "../HomePageClient";
import { browseListings } from "~/lib/server/browse-listings";

export const metadata: Metadata = {
  title: `${APP_NAME} - Home (Preview)`,
  description: APP_DESCRIPTION,
};

// Enable ISR for preview page as well
export const revalidate = 60;

export default async function HomePreview() {
  // Fetch recent listings server-side with thumbnails for fast initial render
  let initialAuctions: EnrichedAuctionData[] = [];
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  const enableServerFetch = !isDevelopment || process.env.ENABLE_SERVER_FETCH === 'true';
  
  if (enableServerFetch) {
    try {
      // Add short timeout to prevent hanging - if database is slow, client will fetch
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Server-side fetch timeout')), 2000); // 2 second timeout
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
        console.error("[Home Preview] Error fetching listings:", error);
      }
      // Continue with empty array - client will handle fetching
    }
  }

  return <HomePageClient initialAuctions={initialAuctions} />;
}



