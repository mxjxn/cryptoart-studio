import { Suspense } from "react";
import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { getMiniAppEmbedMetadata, normalizeUrl } from "~/lib/utils";
import { getRequestSiteUrl } from "~/lib/server/request-site-url";
import { BASE_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import AuctionDetailClient from "../../[listingId]/AuctionDetailClient";

function ListingBaseDetailFallback() {
  return (
    <div className="listing-detail-page min-h-screen bg-neutral-50 text-neutral-900 flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
        <p className="text-neutral-600">Loading Base listing…</p>
      </div>
    </div>
  );
}

interface ListingBasePageProps {
  params: Promise<{ listingId: string }>;
}

export async function generateMetadata({
  params,
}: ListingBasePageProps): Promise<Metadata> {
  let listingId = "unknown";
  try {
    const resolvedParams = await params;
    listingId = resolvedParams.listingId;

    const siteUrl = await getRequestSiteUrl();
    const listingImageUrl = normalizeUrl(
      siteUrl,
      `/listing/base/${listingId}/opengraph-image`
    );
    const listingPageUrl = normalizeUrl(siteUrl, `/listing/base/${listingId}`);

    const title = `Base listing #${listingId} | ${APP_NAME}`;
    const description = "View listing details on Base";

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
            url: `/listing/base/${listingId}/opengraph-image`,
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
    console.error(`[generateMetadata] Error generating Base listing metadata:`, error);
    return {
      title: `Base listing #${listingId} | ${APP_NAME}`,
      description: "View listing details on Base",
    };
  }
}

export default async function ListingBasePage({ params }: ListingBasePageProps) {
  let listingId: string;
  try {
    const resolvedParams = await params;
    listingId = resolvedParams.listingId;
  } catch (error) {
    console.error(`[ListingBasePage] Error getting listing ID:`, error);
    return (
      <div className="listing-detail-page min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center">
        <p className="text-neutral-600">Invalid listing ID</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<ListingBaseDetailFallback />}>
      <AuctionDetailClient listingId={listingId} listingApiChainId={BASE_CHAIN_ID} />
    </Suspense>
  );
}
