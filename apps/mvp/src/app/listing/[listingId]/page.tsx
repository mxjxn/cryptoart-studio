import { Suspense } from "react";
import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { getMiniAppEmbedMetadata, normalizeUrl } from "~/lib/utils";
import { getRequestSiteUrl } from "~/lib/server/request-site-url";
import AuctionDetailClient from "./AuctionDetailClient";

function ListingDetailFallback() {
  return (
    <div className="listing-detail-page min-h-screen bg-neutral-50 text-neutral-900 flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
        <p className="text-neutral-600">Loading listing…</p>
      </div>
    </div>
  );
}

interface ListingPageProps {
  params: Promise<{ listingId: string }>;
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  let listingId: string = 'unknown';
  try {
    const resolvedParams = await params;
    listingId = resolvedParams.listingId;

    const siteUrl = await getRequestSiteUrl();
    // Same host as the browser request — avoids NEXT_PUBLIC_URL=ngrok while testing on localhost,
    // which pointed og:image at ngrok and blocked or stalled the document.
    const listingImageUrl = normalizeUrl(siteUrl, `/listing/${listingId}/opengraph-image`);
    const listingPageUrl = normalizeUrl(siteUrl, `/listing/${listingId}`);

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
    
    return {
      metadataBase: new URL(siteUrl),
      title,
      description,
      openGraph: {
        title,
        description,
        images: [
          {
            url: `/listing/${listingId}/opengraph-image`,
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
  } catch (error) {
    console.error(`[generateMetadata] Error generating metadata:`, error);
    // Return basic metadata on error to prevent redirect
    // Use listingId if we got it, otherwise use a placeholder
    const listingIdFallback = listingId || 'unknown';
    return {
      title: `Listing #${listingIdFallback} | ${APP_NAME}`,
      description: "View listing details and place bids",
    };
  }
}

export default async function ListingPage({ params }: ListingPageProps) {
  let listingId: string;
  try {
    const resolvedParams = await params;
    listingId = resolvedParams.listingId;
  } catch (error) {
    console.error(`[ListingPage] Error getting listing ID:`, error);
    // If we can't get the listing ID, we can't render the page
    // Return a basic error component instead of redirecting
    return (
      <div className="listing-detail-page min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center">
        <p className="text-neutral-600">Invalid listing ID</p>
      </div>
    );
  }
  
  return (
    <Suspense fallback={<ListingDetailFallback />}>
      <AuctionDetailClient listingId={listingId} />
    </Suspense>
  );
}

