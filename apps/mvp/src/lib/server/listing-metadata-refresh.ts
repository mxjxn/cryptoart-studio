import type { Address } from "viem";
import type { EnrichedAuctionData } from "~/lib/types";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import { nftMetadataRevalidateTag } from "~/lib/server/nft-metadata-cache";

const COOLDOWN_MS = 5 * 60 * 1000;
const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

type RefreshState = {
  lastRequestedAt: number;
  inFlight: boolean;
};

export type ListingMediaSnapshot = {
  listingId: string;
  title?: string;
  artist?: string;
  description?: string;
  image?: string;
  thumbnailUrl?: string;
  updatedAt: number;
};

export type MediaFallbackInput = {
  freshImage?: string;
  freshThumbnail?: string;
  cachedThumbnail?: string;
  lastKnownImage?: string;
  lastKnownThumbnail?: string;
  originalImage?: string;
};

const refreshStateByListing = new Map<string, RefreshState>();
const mediaSnapshotByListing = new Map<string, ListingMediaSnapshot>();

function nowMs() {
  return Date.now();
}

function getSnapshotFresh(snapshot: ListingMediaSnapshot | undefined) {
  if (!snapshot) return null;
  if (nowMs() - snapshot.updatedAt > SNAPSHOT_TTL_MS) return null;
  return snapshot;
}

export function getListingMediaSnapshot(listingId: string): ListingMediaSnapshot | null {
  return getSnapshotFresh(mediaSnapshotByListing.get(listingId));
}

export function resolveMediaWithFallback(input: MediaFallbackInput): {
  image?: string;
  thumbnailUrl?: string;
} {
  const thumbnailUrl =
    input.freshThumbnail ||
    input.cachedThumbnail ||
    input.lastKnownThumbnail ||
    input.freshImage ||
    input.lastKnownImage ||
    input.originalImage;
  const image = input.freshImage || input.lastKnownImage || input.originalImage;
  return { image, thumbnailUrl };
}

export function primeListingMediaSnapshot(listing: EnrichedAuctionData) {
  if (!listing.listingId) return;
  if (!listing.image && !listing.thumbnailUrl && !listing.title && !listing.artist) return;
  mediaSnapshotByListing.set(listing.listingId, {
    listingId: listing.listingId,
    title: listing.title,
    artist: listing.artist,
    description: listing.description,
    image: listing.image,
    thumbnailUrl: listing.thumbnailUrl,
    updatedAt: nowMs(),
  });
}

function setSnapshot(
  listingId: string,
  payload: {
    title?: string;
    artist?: string;
    description?: string;
    image?: string;
    thumbnailUrl?: string;
  }
) {
  const existing = mediaSnapshotByListing.get(listingId);
  mediaSnapshotByListing.set(listingId, {
    listingId,
    title: payload.title ?? existing?.title,
    artist: payload.artist ?? existing?.artist,
    description: payload.description ?? existing?.description,
    image: payload.image ?? existing?.image,
    thumbnailUrl: payload.thumbnailUrl ?? payload.image ?? existing?.thumbnailUrl,
    updatedAt: nowMs(),
  });
}

async function refreshListingMetadataInternal(
  listingId: string,
  tokenAddress: string,
  tokenId: string,
  tokenSpec: "ERC721" | "ERC1155" | number
) {
  try {
    const metadata = await fetchNFTMetadata(tokenAddress as Address, tokenId, tokenSpec);
    if (!metadata) return;

    let thumbnailUrl = metadata.image;
    if (metadata.image) {
      try {
        const { getOrGenerateThumbnail } = await import("~/lib/server/thumbnail-generator");
        thumbnailUrl = await getOrGenerateThumbnail(metadata.image, "small");
      } catch {
        thumbnailUrl = metadata.image;
      }
    }

    const isValidFreshImage = await validateImageCandidate(metadata.image);
    const isValidThumb = await validateImageCandidate(thumbnailUrl);
    const previous = getListingMediaSnapshot(listingId);
    const resolvedMedia = resolveMediaWithFallback({
      freshImage: isValidFreshImage ? metadata.image : undefined,
      freshThumbnail: isValidThumb ? thumbnailUrl : undefined,
      lastKnownImage: previous?.image,
      lastKnownThumbnail: previous?.thumbnailUrl,
      originalImage: metadata.image,
    });

    setSnapshot(listingId, {
      title: metadata.title || metadata.name,
      artist: metadata.artist || metadata.creator,
      description: metadata.description,
      image: resolvedMedia.image,
      thumbnailUrl: resolvedMedia.thumbnailUrl,
    });

    try {
      const { revalidatePath, revalidateTag } = await import("next/cache");
      revalidateTag(
        nftMetadataRevalidateTag(tokenAddress as Address, tokenId),
        "default"
      );
      revalidatePath("/");
      revalidatePath("/market");
      revalidatePath("/api/listings/browse");
      revalidatePath(`/listing/${listingId}`);
      revalidatePath(`/api/auctions/${listingId}`);
    } catch {
      // Revalidation failures should not fail the refresh job.
    }
  } finally {
    const state = refreshStateByListing.get(listingId);
    if (state) {
      state.inFlight = false;
      refreshStateByListing.set(listingId, state);
    }
  }
}

async function validateImageCandidate(url?: string): Promise<boolean> {
  if (!url) return false;
  if (url.startsWith("data:")) return true;
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return false;
    const contentType = response.headers.get("content-type") || "";
    return contentType.startsWith("image/");
  } catch {
    return false;
  }
}

export async function requestListingMetadataRefresh(params: {
  listingId: string;
  tokenAddress?: string;
  tokenId?: string;
  tokenSpec?: "ERC721" | "ERC1155" | number;
}) {
  const { listingId, tokenAddress, tokenId, tokenSpec } = params;
  const now = nowMs();
  const state = refreshStateByListing.get(listingId);

  if (state && now - state.lastRequestedAt < COOLDOWN_MS) {
    return {
      accepted: false,
      cooldownRemainingMs: COOLDOWN_MS - (now - state.lastRequestedAt),
      queued: false,
    };
  }

  refreshStateByListing.set(listingId, {
    lastRequestedAt: now,
    inFlight: true,
  });

  if (tokenAddress && tokenId && tokenSpec !== undefined) {
    void refreshListingMetadataInternal(listingId, tokenAddress, tokenId, tokenSpec);
  }

  return {
    accepted: true,
    cooldownRemainingMs: 0,
    queued: true,
  };
}
