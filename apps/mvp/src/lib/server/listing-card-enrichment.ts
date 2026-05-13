import type { EnrichedAuctionData } from "~/lib/types";
import type { Address } from "viem";
import {
  getListingPreviewsByIds,
  makeListingPreviewId,
} from "~/lib/server/listing-preview-store";
import {
  getListingMediaSnapshot,
  primeListingMediaSnapshot,
  resolveMediaWithFallback,
} from "~/lib/server/listing-metadata-refresh";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import {
  normalizeListingType,
  normalizeTokenSpec,
} from "~/lib/server/auction";
import { BASE_CHAIN_ID } from "~/lib/server/subgraph-endpoints";

const THUMBNAIL_LOOKUP_TIMEOUT_MS = 2500;

async function lookupCachedThumbnailBounded(imageUrl: string): Promise<string | null> {
  try {
    const { getCachedThumbnail } = await import("./thumbnail-cache");
    return await Promise.race([
      getCachedThumbnail(imageUrl, "small"),
      new Promise<string | null>((resolve) =>
        setTimeout(() => resolve(null), THUMBNAIL_LOOKUP_TIMEOUT_MS)
      ),
    ]);
  } catch {
    return null;
  }
}

function chainIdForListing(listing: { chainId?: number }): number {
  const c = listing.chainId;
  if (typeof c === "number" && Number.isFinite(c)) return c;
  return BASE_CHAIN_ID;
}

/**
 * Fast path for rails / market cards: preview row + cached metadata + thumbnail cache reads only
 * (no synchronous thumbnail generation).
 */
export async function enrichListingRowsForCardsLight(
  rows: Record<string, unknown>[]
): Promise<EnrichedAuctionData[]> {
  if (rows.length === 0) return [];

  const previewIds = rows.map((r) =>
    makeListingPreviewId(chainIdForListing(r), String((r as { listingId?: unknown }).listingId))
  );
  const previewMap = await getListingPreviewsByIds(previewIds);

  return Promise.all(
    rows.map(async (listing) => {
      const lid = String((listing as { listingId?: unknown }).listingId ?? "");
      const chainId = chainIdForListing(listing);
      const bids = (listing as { bids?: unknown[] }).bids;
      const bidCount = Array.isArray(bids) ? bids.length : 0;
      const highestBid =
        bidCount > 0 && bids
          ? (bids[0] as { amount: string; bidder: string; timestamp: string })
          : undefined;

      const previewKey = makeListingPreviewId(chainId, lid);
      const p = previewMap.get(previewKey);

      let metadata: Awaited<ReturnType<typeof fetchNFTMetadata>> = null;
      const tokenAddress = (listing as { tokenAddress?: string }).tokenAddress;
      const tokenId = (listing as { tokenId?: string }).tokenId;
      const tokenSpec = (listing as { tokenSpec?: unknown }).tokenSpec;
      if (tokenAddress && tokenId) {
        try {
          metadata = await fetchNFTMetadata(
            tokenAddress as Address,
            String(tokenId),
            tokenSpec as never,
            chainId
          );
        } catch {
          /* optional */
        }
      }

      const status = (listing as { status?: string }).status;
      const imageUrl = metadata?.image ?? p?.imageUrl ?? undefined;
      let thumbnailUrl: string | undefined = p?.thumbnailSmallUrl ?? undefined;
      if (imageUrl && status !== "CANCELLED") {
        if (!thumbnailUrl) {
          const small = await lookupCachedThumbnailBounded(imageUrl);
          thumbnailUrl = small ?? undefined;
        }
      }

      const mediaSnapshot = getListingMediaSnapshot(lid);

      const resolvedMedia = resolveMediaWithFallback({
        freshImage: metadata?.image ?? p?.imageUrl ?? undefined,
        cachedThumbnail: thumbnailUrl,
        lastKnownImage: mediaSnapshot?.image ?? undefined,
        lastKnownThumbnail: mediaSnapshot?.thumbnailUrl ?? undefined,
        originalImage: metadata?.image ?? p?.imageUrl ?? undefined,
      });

      const enriched = {
        ...listing,
        chainId,
        listingType: normalizeListingType(
          (listing as { listingType?: unknown }).listingType as never,
          listing as never
        ),
        tokenSpec: normalizeTokenSpec(
          typeof tokenSpec === "string" || typeof tokenSpec === "number"
            ? tokenSpec
            : undefined
        ),
        bidCount,
        highestBid: highestBid
          ? {
              amount: highestBid.amount,
              bidder: highestBid.bidder,
              timestamp: highestBid.timestamp,
            }
          : undefined,
        title: metadata?.title || metadata?.name || p?.title || mediaSnapshot?.title,
        artist: metadata?.artist || metadata?.creator || mediaSnapshot?.artist,
        image: resolvedMedia.image,
        description: metadata?.description || mediaSnapshot?.description,
        thumbnailUrl: resolvedMedia.thumbnailUrl,
        metadata,
      } as EnrichedAuctionData;

      primeListingMediaSnapshot(enriched);
      return enriched;
    })
  );
}
