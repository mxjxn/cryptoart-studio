import { request, gql } from "graphql-request";
import { unstable_cache } from "next/cache";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import type { EnrichedAuctionData } from "~/lib/types";
import { Address } from "viem";
import { getDatabase, hiddenUsers } from '@cryptoart/db';

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error(
    "Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL"
  );
};

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
 * Fetch auction data server-side (for use in route handlers, etc.)
 */
export async function getAuctionServer(
  listingId: string
): Promise<EnrichedAuctionData | null> {
  const startTime = Date.now();
  console.log(`[OG Image] [getAuctionServer] Fetching auction ${listingId}...`);
  
  try {
    const endpoint = getSubgraphEndpoint();
    console.log(`[OG Image] [getAuctionServer] Using subgraph endpoint: ${endpoint.replace(/\/graphql.*$/, '/graphql')}`);

    const data = await request<{ listing: any | null }>(
      endpoint,
      LISTING_BY_ID_QUERY,
      { id: listingId },
      getSubgraphHeaders()
    );

    if (!data.listing) {
      console.warn(`[OG Image] [getAuctionServer] No listing found for ID: ${listingId}`);
      return null;
    }
    
    console.log(`[OG Image] [getAuctionServer] Listing found: status=${data.listing.status}, tokenAddress=${data.listing.tokenAddress}`);

    const listing = data.listing;
    const bidCount = listing.bids?.length || 0;
    const highestBid =
      listing.bids && listing.bids.length > 0
        ? listing.bids[0] // Already sorted by amount desc
        : undefined;

    // Fetch NFT metadata
    let metadata = null;
    if (listing.tokenAddress && listing.tokenId) {
      try {
        console.log(`[OG Image] [getAuctionServer] Fetching NFT metadata for ${listing.tokenAddress}:${listing.tokenId}...`);
        metadata = await fetchNFTMetadata(
          listing.tokenAddress as Address,
          listing.tokenId,
          listing.tokenSpec
        );
        console.log(`[OG Image] [getAuctionServer] Metadata fetched:`, {
          hasTitle: !!metadata?.title,
          hasImage: !!metadata?.image,
          hasArtist: !!metadata?.artist,
        });
      } catch (error) {
        console.error(
          `[OG Image] [getAuctionServer] Error fetching metadata for ${listing.tokenAddress}:${listing.tokenId}:`,
          error
        );
      }
    } else {
      console.warn(`[OG Image] [getAuctionServer] No tokenAddress or tokenId, skipping metadata fetch`);
    }

    // Always generate a small thumbnail for consistency and reliability
    // This ensures og-image embeds work reliably with optimized images
    let thumbnailUrl: string | undefined = undefined;
    const imageUrl = metadata?.image;
    if (imageUrl) {
      try {
        const { getOrGenerateThumbnail } = await import('./thumbnail-generator');
        thumbnailUrl = await getOrGenerateThumbnail(imageUrl, 'small');
        console.log(`[OG Image] [getAuctionServer] Generated thumbnail for listing ${listingId}`);
      } catch (error) {
        console.warn(`[OG Image] [getAuctionServer] Failed to generate thumbnail for ${imageUrl}:`, error);
        // Fall back to original image if thumbnail generation fails
        thumbnailUrl = imageUrl;
      }
    }

    // Normalize listing type and token spec for consistent handling
    const normalizedListingType = normalizeListingType(listing.listingType, listing);
    const normalizedTokenSpec = normalizeTokenSpec(listing.tokenSpec);
    
    console.log(`[OG Image] [getAuctionServer] Listing ${listingId} normalization:`, {
      rawListingType: listing.listingType,
      normalizedListingType,
      rawTokenSpec: listing.tokenSpec,
      normalizedTokenSpec,
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
      title: metadata?.title || metadata?.name,
      artist: metadata?.artist || metadata?.creator,
      image: metadata?.image,
      description: metadata?.description,
      thumbnailUrl,
      metadata,
    };

    const elapsed = Date.now() - startTime;
    console.log(`[OG Image] [getAuctionServer] Auction data fetched successfully in ${elapsed}ms`);
    return enriched;
  } catch (error) {
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

/**
 * Get set of hidden user addresses for filtering.
 * These users' listings should not appear in algorithmic feeds.
 */
export async function getHiddenUserAddresses(): Promise<Set<string>> {
  try {
    const db = getDatabase();
    const hidden = await db.select({ address: hiddenUsers.userAddress }).from(hiddenUsers);
    return new Set(hidden.map(h => h.address.toLowerCase()));
  } catch (error) {
    console.error('[Auction] Error fetching hidden users:', error);
    return new Set();
  }
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
  const endpoint = getSubgraphEndpoint();

  let data: { listings: any[] } = { listings: [] };

  try {
    const headers = getSubgraphHeaders();
    // Log if headers are missing during build
    if (Object.keys(headers).length === 0 && (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.NEXT_PHASE === 'phase-production-build')) {
      console.warn('[Active Listings] No subgraph auth headers - request may fail. Set GRAPH_STUDIO_API_KEY or NEXT_PUBLIC_GRAPH_STUDIO_API_KEY');
    }
    
    data = await request<{ listings: any[] }>(
      endpoint,
      ACTIVE_LISTINGS_QUERY,
      {
        first: Math.min(first, 1000),
        skip,
      },
      headers
    );
  } catch (error: any) {
    // Check if it's an auth error
    const isAuthError = error?.response?.errors?.some((e: any) => 
      e?.message?.includes('auth error') || e?.message?.includes('authorization')
    ) || error?.message?.includes('auth error') || error?.message?.includes('authorization');
    
    if (isAuthError) {
      console.warn(`[Active Listings] Subgraph authentication error - ensure GRAPH_STUDIO_API_KEY is set. Using last-known cache if available.`);
    } else {
      console.error(`[Active Listings] Subgraph error, using last-known cache if available:`, error);
    }
    
    const now = Date.now();
    if (LAST_ACTIVE_CACHE.value && LAST_ACTIVE_CACHE.value.expiresAt > now) {
      console.log(`[Active Listings] Using cached data (expires at ${new Date(LAST_ACTIVE_CACHE.value.expiresAt).toISOString()})`);
      return LAST_ACTIVE_CACHE.value.data;
    }
    return [];
  }

  // Get hidden user addresses to filter out
  const hiddenAddresses = await getHiddenUserAddresses();

  // Filter out listings that are fully sold (even if subgraph hasn't marked them as finalized yet)
  // Also filter out listings from hidden users
  // This ensures sold-out listings and hidden user listings don't appear in active listings
  let activeListings = data.listings.filter((listing) => {
    const totalAvailable = parseInt(listing.totalAvailable || "0");
    const totalSold = parseInt(listing.totalSold || "0");
    const isFullySold = totalAvailable > 0 && totalSold >= totalAvailable;
    
    // Exclude if finalized or fully sold
    if (listing.finalized || isFullySold) {
      console.log(`[Active Listings] Filtering out listing ${listing.listingId}: finalized=${listing.finalized}, totalSold=${totalSold}, totalAvailable=${totalAvailable}, isFullySold=${isFullySold}`);
      return false;
    }
    
    // Exclude if seller is hidden
    if (hiddenAddresses.has(listing.seller?.toLowerCase())) {
      console.log(`[Active Listings] Filtering out listing ${listing.listingId}: seller ${listing.seller} is hidden`);
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
            metadata = await fetchNFTMetadata(
              listing.tokenAddress as Address,
              listing.tokenId,
              listing.tokenSpec
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
          title: metadata?.title || metadata?.name,
          artist: metadata?.artist || metadata?.creator,
          image: metadata?.image,
          description: metadata?.description,
          metadata,
          erc1155TotalSupply,
        };

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

