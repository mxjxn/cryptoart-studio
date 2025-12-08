import { Metadata } from "next";
import { APP_NAME, APP_DESCRIPTION, APP_URL } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import type { EnrichedAuctionData } from "~/lib/types";
import HomePageClient from "./HomePageClient";
import { browseListings } from "~/lib/server/browse-listings";

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
  // Fetch recent listings server-side with thumbnails for fast initial render
  // This allows the homepage to be server-rendered with optimized images
  let initialAuctions: EnrichedAuctionData[] = [];
  
  try {
    initialAuctions = await browseListings({
      first: 24,
      skip: 0,
      orderBy: "createdAt",
      orderDirection: "desc",
      enrich: true,
    });
  } catch (error) {
    console.error("[Homepage] Error fetching listings:", error);
    // Continue with empty array - client will handle fetching
  }

  return <HomePageClient initialAuctions={initialAuctions} />;
}

