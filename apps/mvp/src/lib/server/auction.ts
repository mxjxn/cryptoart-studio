import { request, gql } from "graphql-request";
import { unstable_cache } from "next/cache";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import type { EnrichedAuctionData } from "~/lib/types";
import { CHAIN_ID } from "~/lib/contracts/marketplace";
import { Address } from "viem";
import { getDatabase, hiddenUsers } from '@cryptoart/db';
import {
  getConfiguredSubgraphEndpoints,
} from "~/lib/server/subgraph-endpoints";
import { ensureListingChainId } from "~/lib/server/subgraph-multi-query";
import {
  getListingMediaSnapshot,
  primeListingMediaSnapshot,
  resolveMediaWithFallback,
} from "~/lib/server/listing-metadata-refresh";
import {
  makeListingPreviewId,
  upsertListingPreview,
} from "~/lib/server/listing-preview-store";
import {
  AmbiguousListingError,
  chainIdsFromSubgraphRows,
  isAmbiguousListingError,
} from "~/lib/auction-errors";
import { pickDisplayTitle } from "~/lib/metadata-display";
import { enrichListingMediaAndSupplyCapped } from "~/lib/server/listing-enrichment-capped";

/**
 * Get headers for subgraph requests, including API key if available
 */
const getSubgraphHeaders = (): Record<string, string> => {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY || process.env.NEXT_PUBLIC_GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
  // Log warning if API key is missing (but don't fail - let the request try and fall back to cache)
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.NEXT_PHASE === 'phase-production-build') {
    console.warn('[Subgraph] GRAPH_STUDIO_API_KEY or NEXT_PUBLIC_GRAPH_STUDIO_API_KEY not set - subgraph requests may fail authentication and will fall back to cache');
  }
  return {};
};

const LISTING_BY_ID_QUERY = gql`
  query ListingById($id: ID!) {
    listing(id: $id) {
      id
      listingId
      marketplace
      seller
      tokenAddress
      tokenId
      tokenSpec
      listingType
      initialAmount
      totalAvailable
      totalPerSale
      startTime
      endTime
      lazy
      status
      totalSold
      hasBid
      finalized
      createdAt
      createdAtBlock
      updatedAt
      erc20
      bids(orderBy: amount, orderDirection: desc, first: 1000) {
        id
        bidder
        amount
        timestamp
      }
    }
  }
`;

const LISTING_BY_LISTING_ID_QUERY = gql`
  query ListingByListingId($listingId: BigInt!) {
    listings(
      where: { listingId: $listingId }
      first: 1
    ) {
      id
      listingId
      marketplace
      seller
      tokenAddress
      tokenId
      tokenSpec
      listingType
      initialAmount
      totalAvailable
      totalPerSale
      startTime
      endTime
      lazy
      status
      totalSold
      hasBid
      finalized
      createdAt
      createdAtBlock
      updatedAt
      erc20
      bids(orderBy: amount, orderDirection: desc, first: 1000) {
        id
        bidder
        amount
        timestamp
      }
    }
  }
`;

const ACTIVE_LISTINGS_QUERY = gql`
  query ActiveListings($first: Int!, $skip: Int!) {
    listings(
      where: { status: "ACTIVE", finalized: false }
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      listingId
      marketplace
      seller
      tokenAddress
      tokenId
      tokenSpec
      listingType
      initialAmount
      totalAvailable
      totalPerSale
      startTime
      endTime
      lazy
      status
      totalSold
      hasBid
      finalized
      createdAt
      createdAtBlock
      updatedAt
      erc20
      bids(orderBy: amount, orderDirection: desc, first: 1000) {
        id
        bidder
        amount
        timestamp
      }
    }
  }
`;

// Last-known good cache for active listings to prevent failures on subgraph errors
type CachedActive = { data: EnrichedAuctionData[]; expiresAt: number };
const LAST_ACTIVE_CACHE: { value: CachedActive | null } = { value: null };
const LAST_ACTIVE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Normalize listingType to ensure correct string format
 * Handles both number and string inputs from the subgraph
 * 
 * Contract/Subgraph enum values:
 * - 0 = INVALID (should never happen, fallback to INDIVIDUAL_AUCTION)
 * - 1 = INDIVIDUAL_AUCTION (timed auction with bids)
 * - 2 = FIXED_PRICE (buy now at set price)
 * - 3 = DYNAMIC_PRICE (price changes over time, must be lazy)
 * - 4 = OFFERS_ONLY (accepts offers only)
 * 
 * The subgraph stores listingType as Int, but GraphQL may return it as:
 * - number: 2
 * - string number: "2"
 * - string name: "FIXED_PRICE"
 * 
 * We can detect buggy "DYNAMIC_PRICE" entries because:
 * - DYNAMIC_PRICE listings MUST be lazy (per contract requirements)
 * - If we see "DYNAMIC_PRICE" but lazy=false, it's likely a buggy FIXED_PRICE (type 2)
 */
export function normalizeListingType(
  listingType: string | number | undefined,
  listing?: { lazy?: boolean }
): "INDIVIDUAL_AUCTION" | "FIXED_PRICE" | "DYNAMIC_PRICE" | "OFFERS_ONLY" {
  // Type mapping from numeric values
  const typeFromNumber = (num: number): "INDIVIDUAL_AUCTION" | "FIXED_PRICE" | "DYNAMIC_PRICE" | "OFFERS_ONLY" => {
    switch (num) {
      case 0: return "INDIVIDUAL_AUCTION"; // INVALID maps to INDIVIDUAL_AUCTION as fallback
      case 1: return "INDIVIDUAL_AUCTION";
      case 2: return "FIXED_PRICE";
      case 3: return "DYNAMIC_PRICE";
      case 4: return "OFFERS_ONLY";
      default: return "INDIVIDUAL_AUCTION";
    }
  };

  // Handle number input directly
  if (typeof listingType === 'number') {
    const result = typeFromNumber(listingType);
    // Fix buggy DYNAMIC_PRICE: if not lazy, it's likely a FIXED_PRICE
    if (result === "DYNAMIC_PRICE" && listing && listing.lazy === false) {
      return "FIXED_PRICE";
    }
    return result;
  }
  
  // Handle string input - could be a numeric string or a type name
  const typeStr = String(listingType || "").trim();
  
  // First, check if it's a numeric string (e.g., "2")
  const numericValue = parseInt(typeStr, 10);
  if (!isNaN(numericValue) && String(numericValue) === typeStr) {
    const result = typeFromNumber(numericValue);
    // Fix buggy DYNAMIC_PRICE: if not lazy, it's likely a FIXED_PRICE
    if (result === "DYNAMIC_PRICE" && listing && listing.lazy === false) {
      return "FIXED_PRICE";
    }
    return result;
  }
  
  // Handle string type names
  const upperTypeStr = typeStr.toUpperCase();
  
  // Fix buggy "DYNAMIC_PRICE" mapping: if it's marked as DYNAMIC_PRICE but not lazy,
  // it's likely a buggy FIXED_PRICE (type 2 was incorrectly mapped to DYNAMIC_PRICE)
  if (upperTypeStr === "DYNAMIC_PRICE" && listing && listing.lazy === false) {
    return "FIXED_PRICE";
  }
  
  // Validate and return correct type
  if (upperTypeStr === "INDIVIDUAL_AUCTION" || upperTypeStr === "FIXED_PRICE" || 
      upperTypeStr === "DYNAMIC_PRICE" || upperTypeStr === "OFFERS_ONLY") {
    return upperTypeStr as "INDIVIDUAL_AUCTION" | "FIXED_PRICE" | "DYNAMIC_PRICE" | "OFFERS_ONLY";
  }
  
  // Default fallback
  console.warn(`[normalizeListingType] Unknown listingType: "${listingType}" (type: ${typeof listingType}), defaulting to INDIVIDUAL_AUCTION`);
  return "INDIVIDUAL_AUCTION";
}

/**
 * Normalize tokenSpec to ensure correct string format
 * Handles both number and string inputs from the subgraph
 * 
 * Contract/Subgraph enum values:
 * - 0 = NONE (invalid, fallback to ERC721)
 * - 1 = ERC721
 * - 2 = ERC1155
 * 
 * The subgraph stores tokenSpec as Int, but GraphQL may return it as:
 * - number: 1 or 2
 * - string number: "1" or "2"
 * - string name: "ERC721" or "ERC1155"
 */
export function normalizeTokenSpec(
  tokenSpec: string | number | undefined
): "ERC721" | "ERC1155" {
  // Type mapping from numeric values
  const specFromNumber = (num: number): "ERC721" | "ERC1155" => {
    switch (num) {
      case 0: return "ERC721"; // NONE/invalid fallback to ERC721
      case 1: return "ERC721";
      case 2: return "ERC1155";
      default: return "ERC721";
    }
  };

  // Handle number input directly
  if (typeof tokenSpec === 'number') {
    return specFromNumber(tokenSpec);
  }
  
  // Handle string input - could be a numeric string or a spec name
  const specStr = String(tokenSpec || "").trim();
  
  // First, check if it's a numeric string (e.g., "2")
  const numericValue = parseInt(specStr, 10);
  if (!isNaN(numericValue) && String(numericValue) === specStr) {
    return specFromNumber(numericValue);
  }
  
  // Handle string spec names
  const upperSpecStr = specStr.toUpperCase();
  
  if (upperSpecStr === "ERC721" || upperSpecStr === "ERC1155") {
    return upperSpecStr as "ERC721" | "ERC1155";
  }
  
  // Default fallback
  console.warn(`[normalizeTokenSpec] Unknown tokenSpec: "${tokenSpec}" (type: ${typeof tokenSpec}), defaulting to ERC721`);
  return "ERC721";
}

/**
 * Resolve the listing entity from the subgraph only (no metadata, thumbnails, or RPC).
 * Used by page-status and as the first step of getAuctionServer.
 */
export async function resolveListingFromSubgraph(
  listingId: string,
  chainIdFilter?: number
): Promise<any | null> {
  const configured = getConfiguredSubgraphEndpoints();
  const endpoints =
    chainIdFilter == null
      ? configured
      : configured.filter((e) => e.chainId === chainIdFilter);
  if (chainIdFilter != null && endpoints.length === 0) {
    return null;
  }
  const headers = getSubgraphHeaders();

  const listingIdNum = parseInt(listingId, 10);
  const isNumeric = !Number.isNaN(listingIdNum);

  const settled = await Promise.allSettled(
    endpoints.map((ep) => {
      if (isNumeric) {
        return request<{ listings: any[] }>(
          ep.url,
          LISTING_BY_LISTING_ID_QUERY,
          { listingId: listingIdNum },
          headers
        );
      }

      return request<{ listing: any | null }>(
        ep.url,
        LISTING_BY_ID_QUERY,
        { id: listingId },
        headers
      ).then((r) => ({
        listings: r.listing ? [r.listing] : [],
      }));
    })
  );

  const matched: any[] = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status !== "fulfilled") continue;
    const ep = endpoints[i];
    for (const row of s.value.listings ?? []) {
      matched.push(ensureListingChainId(row, ep.chainId));
    }
  }

  if (matched.length === 0) return null;
  if (matched.length > 1) {
    throw new AmbiguousListingError(listingId, chainIdsFromSubgraphRows(matched));
  }

  return matched[0];
}

/**
 * Fetch auction data server-side (for use in route handlers, etc.)
 */
export async function getAuctionServer(
  listingId: string,
  opts?: { chainId?: number }
): Promise<EnrichedAuctionData | null> {
  const startTime = Date.now();
  console.log(`[OG Image] [getAuctionServer] Fetching auction ${listingId}...`);
  
  try {
    const listing = await resolveListingFromSubgraph(listingId, opts?.chainId);
    if (!listing) {
      const scope =
        opts?.chainId != null
          ? `scoped to chainId=${opts.chainId}`
          : "searched all configured subgraph endpoints";
      console.warn(
        `[OG Image] [getAuctionServer] No listing found for ID: ${listingId} (${scope}). ` +
          "Common causes: stale `featured_listings` / homepage pins, wrong `chain_id` for that row, subgraph URL or schema mismatch, or the auction id never existed on the networks you query."
      );
      return null;
    }

    const hiddenSellers = await getHiddenUserAddresses();
    if (isListingBlockedFromProduct(listing, hiddenSellers)) {
      console.warn(
        `[OG Image] [getAuctionServer] Blocked listing ${listingId} (hidden/blocked seller or BLOCKED_LISTING_IDS)`
      );
      return null;
    }

    console.log(`[OG Image] [getAuctionServer] Listing found: listingId=${listing.listingId}, status=${listing.status}, tokenAddress=${listing.tokenAddress}`);
    const bidCount = listing.bids?.length || 0;
    const highestBid =
      listing.bids && listing.bids.length > 0
        ? listing.bids[0] // Already sorted by amount desc
        : undefined;

    const capped = await enrichListingMediaAndSupplyCapped(
      listing as Record<string, unknown>,
      { listingIdForLog: listingId, requestChainId: opts?.chainId }
    );
    const {
      metadata,
      thumbnailUrl: cappedThumb,
      detailThumbnailUrl: cappedDetailThumb,
      erc1155TotalSupply,
      erc721TotalSupply,
    } = capped;

    const mediaSnapshot = getListingMediaSnapshot(String(listing.listingId));

    // Normalize listing type and token spec for consistent handling
    const normalizedListingType = normalizeListingType(listing.listingType, listing);
    const normalizedTokenSpec = normalizeTokenSpec(listing.tokenSpec);
    
    console.log(`[OG Image] [getAuctionServer] Listing ${listingId} normalization:`, {
      rawListingType: listing.listingType,
      normalizedListingType,
      rawTokenSpec: listing.tokenSpec,
      normalizedTokenSpec,
    });

    const resolvedMedia = resolveMediaWithFallback({
      freshImage: metadata?.image,
      cachedThumbnail: cappedThumb,
      lastKnownImage: mediaSnapshot?.image,
      lastKnownThumbnail: mediaSnapshot?.thumbnailUrl,
      originalImage: metadata?.image,
    });

    const enriched: EnrichedAuctionData = {
      ...listing,
      listingType: normalizedListingType,
      tokenSpec: normalizedTokenSpec,
      bidCount,
      highestBid: highestBid
        ? {
            amount: highestBid.amount,
            bidder: highestBid.bidder,
            timestamp: highestBid.timestamp,
          }
        : undefined,
      title:
        pickDisplayTitle(metadata) ??
        metadata?.title ??
        metadata?.name ??
        mediaSnapshot?.title,
      artist: metadata?.artist || metadata?.creator || mediaSnapshot?.artist,
      image: resolvedMedia.image,
      description: metadata?.description || mediaSnapshot?.description,
      thumbnailUrl: resolvedMedia.thumbnailUrl,
      detailThumbnailUrl: cappedDetailThumb,
      metadata,
      erc1155TotalSupply,
      erc721TotalSupply,
    };
    primeListingMediaSnapshot(enriched);

    if (enriched.image || enriched.title) {
      void upsertListingPreview({
        listingId: makeListingPreviewId(listing.chainId, String(listing.listingId)),
        tokenAddress: String(listing.tokenAddress),
        tokenId: String(listing.tokenId),
        imageUrl: enriched.image ?? null,
        thumbnailSmallUrl: enriched.thumbnailUrl ?? null,
        title: enriched.title ?? null,
      });
    }

    const elapsed = Date.now() - startTime;
    console.log(`[OG Image] [getAuctionServer] Auction data fetched successfully in ${elapsed}ms`);
    return enriched;
  } catch (error) {
    if (isAmbiguousListingError(error)) {
      throw error;
    }
    const elapsed = Date.now() - startTime;
    console.error(`[OG Image] [getAuctionServer] Error fetching auction server-side (${elapsed}ms):`, error);
    if (error instanceof Error) {
      console.error(`[OG Image] [getAuctionServer] Error details:`, {
        message: error.message,
        stack: error.stack,
      });
    }
    return null;
  }
}

/** Comma-separated `0x…` wallets merged into hidden set (Vercel: `BLOCKED_SELLER_ADDRESSES`). */
function parseCommaSeparatedAddresses(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((a) => a.startsWith("0x") && a.length >= 42);
}

/**
 * Comma-separated listing ids to block everywhere (Vercel: `BLOCKED_LISTING_IDS`), e.g. `117,118`.
 * Use when the seller row is not in `hidden_users` but the listing must still be suppressed.
 */
export function getBlockedListingIdsFromEnv(): Set<string> {
  const raw = process.env.BLOCKED_LISTING_IDS;
  const set = new Set<string>();
  if (!raw?.trim()) return set;
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id) set.add(id);
  }
  return set;
}

/** True when this listing must not be enriched or shown (detail, OG, cron). */
export function isListingBlockedFromProduct(
  listing: { listingId?: unknown; seller?: unknown },
  hiddenSellers: Set<string>
): boolean {
  const lid = String(listing.listingId ?? "").trim();
  if (lid && getBlockedListingIdsFromEnv().has(lid)) return true;
  const seller =
    typeof listing.seller === "string" ? listing.seller.toLowerCase() : "";
  if (seller && hiddenSellers.has(seller)) return true;
  return false;
}

/**
 * Get set of hidden user addresses for filtering.
 * These users' listings should not appear in algorithmic feeds.
 * Merges DB `hidden_users` with optional env `BLOCKED_SELLER_ADDRESSES` (comma-separated).
 */
export async function getHiddenUserAddresses(): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const db = getDatabase();
    const hidden = await db.select({ address: hiddenUsers.userAddress }).from(hiddenUsers);
    for (const h of hidden) {
      set.add(h.address.toLowerCase());
    }
  } catch (error) {
    console.error("[Auction] Error fetching hidden users:", error);
  }
  for (const a of parseCommaSeparatedAddresses(process.env.BLOCKED_SELLER_ADDRESSES)) {
    set.add(a);
  }
  return set;
}

/**
 * Fetch and enrich auctions from subgraph
 * This function is cached for 60 seconds to reduce subgraph load
 */
async function fetchActiveAuctions(
  first: number,
  skip: number,
  enrich: boolean
): Promise<EnrichedAuctionData[]> {
  const endpoints = getConfiguredSubgraphEndpoints();
  const headers = getSubgraphHeaders();

  if (Object.keys(headers).length === 0 && (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.NEXT_PHASE === 'phase-production-build')) {
    console.warn('[Active Listings] No subgraph auth headers - request may fail. Set GRAPH_STUDIO_API_KEY or NEXT_PUBLIC_GRAPH_STUDIO_API_KEY');
  }

  // Dual-network query: request the same listing window from each subgraph deployment,
  // then merge results at the application layer.
  const settled = await Promise.allSettled(
    endpoints.map((ep) => {
      return request<{ listings: any[] }>(
        ep.url,
        ACTIVE_LISTINGS_QUERY,
        {
          first: Math.min(first, 1000),
          skip,
        },
        headers
      );
    })
  );

  const mergedListings: any[] = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status !== "fulfilled") continue;
    const ep = endpoints[i];
    for (const row of s.value.listings ?? []) {
      mergedListings.push(ensureListingChainId(row, ep.chainId));
    }
  }

  if (mergedListings.length === 0) {
    // If both endpoints failed, fall back to last-known cache (stale-while-revalidate).
    const now = Date.now();
    if (LAST_ACTIVE_CACHE.value && LAST_ACTIVE_CACHE.value.expiresAt > now) {
      console.log(`[Active Listings] Using cached data (expires at ${new Date(LAST_ACTIVE_CACHE.value.expiresAt).toISOString()})`);
      return LAST_ACTIVE_CACHE.value.data;
    }
    return [];
  }

  const data = { listings: mergedListings };

  // Get hidden user addresses to filter out
  const hiddenAddresses = await getHiddenUserAddresses();

  // Filter out listings that are fully sold (even if subgraph hasn't marked them as finalized yet)
  // Also filter out listings from hidden users
  // This ensures sold-out listings and hidden user listings don't appear in active listings
  let activeListings = data.listings.filter((listing) => {
    const totalAvailable = parseInt(listing.totalAvailable || "0");
    const totalSold = parseInt(listing.totalSold || "0");
    const isFullySold = totalAvailable > 0 && totalSold >= totalAvailable;
    
    if (listing.finalized || isFullySold) {
      console.log(`[Active Listings] Filtering out listing ${listing.listingId}: finalized=${listing.finalized}, totalSold=${totalSold}, totalAvailable=${totalAvailable}, isFullySold=${isFullySold}`);
      return false;
    }
    
    if (isListingBlockedFromProduct(listing, hiddenAddresses)) {
      console.log(`[Active Listings] Filtering out listing ${listing.listingId}: blocked or hidden seller`);
      return false;
    }
    
    return true;
  });
  
  console.log(`[Active Listings] Filtered ${data.listings.length} listings down to ${activeListings.length} active listings (${hiddenAddresses.size} hidden users)`);

  let enrichedAuctions: EnrichedAuctionData[] = activeListings;

  if (enrich) {
    // Enrich auctions with metadata and bid information
    enrichedAuctions = await Promise.all(
      activeListings.map(async (listing) => {
        const bidCount = listing.bids?.length || 0;
        const highestBid = listing.bids && listing.bids.length > 0 
          ? listing.bids[0] // Already sorted by amount desc
          : undefined;

        // Fetch NFT metadata
        let metadata = null;
        if (listing.tokenAddress && listing.tokenId) {
          try {
            const rawCid = listing.chainId;
            const parsedCid =
              typeof rawCid === "number"
                ? rawCid
                : parseInt(String(rawCid ?? ""), 10);
            const nftChainId = Number.isFinite(parsedCid) ? parsedCid : CHAIN_ID;
            metadata = await fetchNFTMetadata(
              listing.tokenAddress as Address,
              listing.tokenId,
              listing.tokenSpec,
              nftChainId
            );
          } catch (error) {
            console.error(`Error fetching metadata for ${listing.tokenAddress}:${listing.tokenId}:`, error);
          }
        }

        // Fetch ERC1155 total supply if applicable
        // Wrap in try-catch to ensure it never breaks Promise.all
        let erc1155TotalSupply: string | undefined = undefined;
        if ((listing.tokenSpec === "ERC1155" || listing.tokenSpec === 2) && listing.tokenAddress && listing.tokenId) {
          try {
            const { getERC1155TotalSupply } = await import('~/lib/server/erc1155-supply');
            const totalSupply = await getERC1155TotalSupply(
              listing.tokenAddress,
              listing.tokenId
            );
            if (totalSupply !== null) {
              erc1155TotalSupply = totalSupply.toString();
            }
          } catch (error: any) {
            // Log but don't throw - this is optional enrichment data
            const errorMsg = error?.message || String(error);
            console.error(`[fetchActiveAuctions] Error fetching ERC1155 total supply for ${listing.tokenAddress}:${listing.tokenId}:`, errorMsg);
            // Continue without total supply - listing will still work
          }
        }

        // Fetch ERC721 collection total supply if applicable
        // Wrap in try-catch to ensure it never breaks Promise.all
        let erc721TotalSupply: number | undefined = undefined;
        if ((listing.tokenSpec === "ERC721" || listing.tokenSpec === 1) && listing.tokenAddress) {
          try {
            const { fetchERC721TotalSupply } = await import('~/lib/erc721-supply');
            const totalSupply = await fetchERC721TotalSupply(listing.tokenAddress);
            if (totalSupply !== null) {
              erc721TotalSupply = totalSupply;
            }
          } catch (error: any) {
            // Log but don't throw - this is optional enrichment data
            const errorMsg = error?.message || String(error);
            console.error(`[fetchActiveAuctions] Error fetching ERC721 total supply for ${listing.tokenAddress}:`, errorMsg);
            // Continue without total supply - listing will still work
          }
        }

        // Generate thumbnail for homepage display (optimized, cached)
        let thumbnailUrl: string | undefined = undefined;
        const imageUrl = metadata?.image;
        const mediaSnapshot = getListingMediaSnapshot(String(listing.listingId));
        if (imageUrl) {
          try {
            const { getOrGenerateThumbnail } = await import('./thumbnail-generator');
            thumbnailUrl = await getOrGenerateThumbnail(imageUrl, 'small');
          } catch (error) {
            // If thumbnail generation fails, fall back to original image
            console.warn(`[fetchActiveAuctions] Failed to generate thumbnail for ${imageUrl}:`, error);
            thumbnailUrl = imageUrl;
          }
        }

        const resolvedMedia = resolveMediaWithFallback({
          freshImage: metadata?.image,
          cachedThumbnail: thumbnailUrl,
          lastKnownImage: mediaSnapshot?.image,
          lastKnownThumbnail: mediaSnapshot?.thumbnailUrl,
          originalImage: metadata?.image,
        });

        const enriched: EnrichedAuctionData = {
          ...listing,
          listingType: normalizeListingType(listing.listingType, listing),
          tokenSpec: normalizeTokenSpec(listing.tokenSpec),
          bidCount,
          highestBid: highestBid ? {
            amount: highestBid.amount,
            bidder: highestBid.bidder,
            timestamp: highestBid.timestamp,
          } : undefined,
          title: metadata?.title || metadata?.name || mediaSnapshot?.title,
          artist: metadata?.artist || metadata?.creator || mediaSnapshot?.artist,
          image: resolvedMedia.image,
          description: metadata?.description || mediaSnapshot?.description,
          thumbnailUrl: resolvedMedia.thumbnailUrl,
          metadata,
          erc1155TotalSupply,
          erc721TotalSupply,
        };

        primeListingMediaSnapshot(enriched);

        return enriched;
      })
    );
  }

  // Store last-known good cache
  LAST_ACTIVE_CACHE.value = {
    data: enrichedAuctions,
    expiresAt: Date.now() + LAST_ACTIVE_TTL_MS,
  };

  return enrichedAuctions;
}

/**
 * Cached version of fetchActiveAuctions
 * Cache TTL: 60 seconds with stale-while-revalidate for better performance
 * 
 * This function can be used both in API routes and server components
 * Cache is invalidated via revalidateTag('auctions') when listings change
 * 
 * Performance optimization: Reduced from 15 minutes to 60 seconds to balance
 * between reducing disk IO and keeping data fresh. The cache now uses a
 * stale-while-revalidate strategy for better UX.
 */
export const getCachedActiveAuctions = unstable_cache(
  async (first: number, skip: number, enrich: boolean) => {
    return fetchActiveAuctions(first, skip, enrich);
  },
  ['active-auctions'],
  {
    revalidate: 60, // Cache for 60 seconds - significantly reduces disk IO while keeping data fresh
    tags: ['auctions'], // Can be invalidated with revalidateTag('auctions')
  }
);

/**
 * Non-cached version of fetchActiveAuctions
 * Use this when you need fresh data (e.g., when client polls for updates)
 */
export async function fetchActiveAuctionsUncached(
  first: number,
  skip: number,
  enrich: boolean
): Promise<EnrichedAuctionData[]> {
  return fetchActiveAuctions(first, skip, enrich);
}

