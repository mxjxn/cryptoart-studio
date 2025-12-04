import { Metadata } from "next";
import { APP_NAME, APP_DESCRIPTION, APP_URL } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import { getCachedActiveAuctions } from "~/lib/server/auction";
import type { EnrichedAuctionData } from "~/lib/types";
import HomePageClient from "./HomePageClient";

// Revalidate is handled by cron job that checks for new listings
// The cron job runs every 15 minutes and revalidates if listing ID changes
export const revalidate = false; // Disable automatic revalidation, use cron job instead

export async function generateMetadata(): Promise<Metadata> {
  // Use the opengraph-image route that shows recent listings with images
  // (not the /api/opengraph-image which is just text)
  const ogImageUrl = `${APP_URL}/opengraph-image`;
  
  return {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    openGraph: {
      title: APP_NAME,
      description: APP_DESCRIPTION,
      images: [ogImageUrl],
    },
    other: {
      "fc:miniapp": JSON.stringify(getMiniAppEmbedMetadata(ogImageUrl)),
      "fc:frame": JSON.stringify(getMiniAppEmbedMetadata(ogImageUrl)),
    },
  };
}

export default async function Home() {
  // Fetch auctions server-side with caching for optimistic rendering
  // This data will be served immediately, then updated client-side with fresh data
  let initialAuctions: EnrichedAuctionData[] = [];
  try {
    initialAuctions = await getCachedActiveAuctions(16, 0, true);
  } catch (error) {
    console.error('Error fetching initial auctions:', error);
    // Continue with empty array - client will fetch fresh data
  }

  return <HomePageClient initialAuctions={initialAuctions} />;
}

