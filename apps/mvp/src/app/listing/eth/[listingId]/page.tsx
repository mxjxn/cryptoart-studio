import { Suspense } from "react";
import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { getMiniAppEmbedMetadata, normalizeUrl } from "~/lib/utils";
import { getRequestSiteUrl } from "~/lib/server/request-site-url";
import { ETHEREUM_MAINNET_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import AuctionDetailClient from "../../[listingId]/AuctionDetailClient";

function ListingEthDetailFallback() {
  return (
    <div className="listing-detail-page min-h-screen bg-neutral-50 text-neutral-900 flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
        <p className="text-neutral-600">Loading Ethereum listing…</p>
      </div>
    </div>
  );
}

interface ListingEthPageProps {
  params: Promise<{ listingId: string }>;
}

export async function generateMetadata({ params }: ListingEthPageProps): Promise<Metadata> {
  let listingId: string = "unknown";
  try {
    const resolvedParams = await params;
    listingId = resolvedParams.listingId;

    const siteUrl = await getRequestSiteUrl();
    const listingImageUrl = normalizeUrl(
      siteUrl,
      `/listing/eth/${listingId}/opengraph-image`
    );
    const listingPageUrl = normalizeUrl(siteUrl, `/listing/eth/${listingId}`);

    const title = `Ethereum listing #${listingId} | ${APP_NAME}`;
    const description = "View listing details on Ethereum";

    const miniappMetadata = getMiniAppEmbedMetadata(
      listingImageUrl,
      listingPageUrl,
      false,
      listingImageUrl,
      "View Listing"
    );
    const frameMetadata = getMiniAppEmbedMetadata(
      listingImageUrl,
      listingPageUrl,
      true,
      listingImageUrl,
      "View Listing"
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
            url: `/listing/eth/${listingId}/opengraph-image`,
            width: 1200,
            height: 800,
          },
        ],
      },
      other: {
        "fc:miniapp": JSON.stringify(miniappMetadata),
        "fc:frame": JSON.stringify(frameMetadata),
      },
    };
  } catch (error) {
    console.error(`[generateMetadata] Error generating ETH listing metadata:`, error);
    return {
      title: `Ethereum listing #${listingId} | ${APP_NAME}`,
      description: "View listing details on Ethereum",
    };
  }
}

export default async function ListingEthPage({ params }: ListingEthPageProps) {
  let listingId: string;
  try {
    const resolvedParams = await params;
    listingId = resolvedParams.listingId;
  } catch (error) {
    console.error(`[ListingEthPage] Error getting listing ID:`, error);
    return (
      <div className="listing-detail-page min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center">
        <p className="text-neutral-600">Invalid listing ID</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<ListingEthDetailFallback />}>
      <AuctionDetailClient
        listingId={listingId}
        listingApiChainId={ETHEREUM_MAINNET_CHAIN_ID}
      />
    </Suspense>
  );
}
