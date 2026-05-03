import { Suspense } from "react";
import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { getMiniAppEmbedMetadata, normalizeUrl } from "~/lib/utils";
import { getRequestSiteUrl } from "~/lib/server/request-site-url";
import AuctionDetailClient from "./AuctionDetailClient";

function AuctionDetailFallback() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" />
        <p className="text-neutral-400">Loading auction…</p>
      </div>
    </div>
  );
}

interface AuctionPageProps {
  params: Promise<{ listingId: string }>;
}

export async function generateMetadata({ params }: AuctionPageProps): Promise<Metadata> {
  const { listingId } = await params;

  const siteUrl = await getRequestSiteUrl();
  const auctionImageUrl = normalizeUrl(siteUrl, `/auction/${listingId}/opengraph-image`);
  const auctionPageUrl = normalizeUrl(siteUrl, `/auction/${listingId}`);

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
  
  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: `/auction/${listingId}/opengraph-image`,
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
  return (
    <Suspense fallback={<AuctionDetailFallback />}>
      <AuctionDetailClient listingId={listingId} />
    </Suspense>
  );
}

