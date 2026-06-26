import { Suspense } from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { APP_NAME } from "~/lib/constants";
import { CHAIN_ID } from "~/lib/contracts/marketplace";
import { getMiniAppEmbedMetadata, normalizeUrl } from "~/lib/utils";
import { getRequestSiteUrl } from "~/lib/server/request-site-url";
import {
  resolveListingFromSubgraph,
  getHiddenUserAddresses,
  isListingBlockedFromProduct,
} from "~/lib/server/auction";
import { isAmbiguousListingError } from "~/lib/auction-errors";
import {
  canonicalListingDetailPath,
  parseListingChainIdQueryParam,
} from "~/lib/listing-chain-paths";
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
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function queryStringWithoutChainId(
  searchParams: { [key: string]: string | string[] | undefined }
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "chainId") continue;
    if (typeof value === "string") {
      qs.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        qs.append(key, item);
      }
    }
  }
  return qs.toString();
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  let listingId: string = 'unknown';
  try {
    const resolvedParams = await params;
    listingId = resolvedParams.listingId;

    const siteUrl = await getRequestSiteUrl();
    // Same host as the browser request — avoids NEXT_PUBLIC_URL=ngrok while testing on localhost,
    // which pointed og:image at ngrok and blocked or stalled the document.
    const ogPath = `/listing/${listingId}/opengraph-image?chainId=${CHAIN_ID}`;
    const listingImageUrl = normalizeUrl(siteUrl, ogPath);
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
            url: ogPath,
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

export default async function ListingPage({ params, searchParams }: ListingPageProps) {
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

  const resolvedSearchParams = await searchParams;
  const chainIdFromQuery = parseListingChainIdQueryParam(
    typeof resolvedSearchParams.chainId === "string"
      ? resolvedSearchParams.chainId
      : undefined
  );
  const trailingQuery = queryStringWithoutChainId(resolvedSearchParams);
  // The canonical path for this page (Base-chain listings live here without a chain prefix).
  // Used below to skip self-redirects that would cause an infinite redirect loop.
  const currentPath = `/listing/${listingId}`;

  if (chainIdFromQuery != null) {
    const canonicalPath = canonicalListingDetailPath(chainIdFromQuery, listingId);
    // Only redirect if the canonical path differs from the current path to avoid self-redirect loops.
    // For Base-chain listings, canonicalListingDetailPath returns `/listing/${id}` which is
    // already this page, so skipping the redirect allows the page to render normally.
    if (canonicalPath !== currentPath) {
      redirect(trailingQuery ? `${canonicalPath}?${trailingQuery}` : canonicalPath);
    }
  }

  let canonicalListingPath: string | null = null;
  try {
    const listing = await resolveListingFromSubgraph(listingId);
    if (listing) {
      const hidden = await getHiddenUserAddresses();
      if (!isListingBlockedFromProduct(listing, hidden)) {
        const rawCid = listing.chainId;
        const cid =
          typeof rawCid === "number"
            ? rawCid
            : parseInt(String(rawCid ?? ""), 10);
        if (Number.isFinite(cid)) {
          canonicalListingPath = canonicalListingDetailPath(
            cid,
            String(listing.listingId ?? listingId)
          );
        }
      }
    }
  } catch (e) {
    if (!isAmbiguousListingError(e)) {
      // Transient subgraph errors: fall through to client fetch.
    }
  }

  if (canonicalListingPath && canonicalListingPath !== currentPath) {
    redirect(
      trailingQuery
        ? `${canonicalListingPath}?${trailingQuery}`
        : canonicalListingPath
    );
  }

  return (
    <Suspense fallback={<ListingDetailFallback />}>
      <AuctionDetailClient listingId={listingId} />
    </Suspense>
  );
}

