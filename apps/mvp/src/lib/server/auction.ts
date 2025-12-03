import { request, gql } from "graphql-request";
import { unstable_cache } from "next/cache";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import type { EnrichedAuctionData } from "~/lib/types";
import { Address } from "viem";

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error(
    "Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL"
  );
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

/**
 * Normalize listingType to ensure correct string format
 * Handles both number and string inputs, and corrects buggy mappings from old subgraph version
 * 
 * Old subgraph bug mapping:
 * - 0 (INVALID) -> "INDIVIDUAL_AUCTION" (should be "INVALID")
 * - 1 (INDIVIDUAL_AUCTION) -> "FIXED_PRICE" (should be "INDIVIDUAL_AUCTION")
 * - 2 (FIXED_PRICE) -> "DYNAMIC_PRICE" (should be "FIXED_PRICE")
 * - 3 (DYNAMIC_PRICE) -> "UNKNOWN" (should be "DYNAMIC_PRICE")
 * - 4 (OFFERS_ONLY) -> "UNKNOWN" (should be "OFFERS_ONLY")
 * 
 * We can detect buggy "DYNAMIC_PRICE" entries because:
 * - DYNAMIC_PRICE listings MUST be lazy (per contract requirements)
 * - If we see "DYNAMIC_PRICE" but lazy=false, it's likely a buggy FIXED_PRICE (type 2)
 */
export function normalizeListingType(
  listingType: string | number | undefined,
  listing?: { lazy?: boolean }
): "INDIVIDUAL_AUCTION" | "FIXED_PRICE" | "DYNAMIC_PRICE" | "OFFERS_ONLY" {
  // Handle number input (from subgraph that stores as Int)
  if (typeof listingType === 'number') {
    switch (listingType) {
      case 0: return "INDIVIDUAL_AUCTION"; // INVALID maps to INDIVIDUAL_AUCTION as fallback
      case 1: return "INDIVIDUAL_AUCTION";
      case 2: return "FIXED_PRICE";
      case 3: return "DYNAMIC_PRICE";
      case 4: return "OFFERS_ONLY";
      default: return "INDIVIDUAL_AUCTION";
    }
  }
  
  // Handle string input
  const typeStr = String(listingType || "").toUpperCase();
  
  // Fix buggy "DYNAMIC_PRICE" mapping: if it's marked as DYNAMIC_PRICE but not lazy,
  // it's likely a buggy FIXED_PRICE (type 2 was incorrectly mapped to DYNAMIC_PRICE)
  if (typeStr === "DYNAMIC_PRICE" && listing && listing.lazy === false) {
    return "FIXED_PRICE";
  }
  
  // Validate and return correct type
  if (typeStr === "INDIVIDUAL_AUCTION" || typeStr === "FIXED_PRICE" || 
      typeStr === "DYNAMIC_PRICE" || typeStr === "OFFERS_ONLY") {
    return typeStr as "INDIVIDUAL_AUCTION" | "FIXED_PRICE" | "DYNAMIC_PRICE" | "OFFERS_ONLY";
  }
  
  // Default fallback
  return "INDIVIDUAL_AUCTION";
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
      { id: listingId }
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

    const enriched: EnrichedAuctionData = {
      ...listing,
      listingType: normalizeListingType(listing.listingType, listing),
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
 * Fetch and enrich auctions from subgraph
 * This function is cached for 60 seconds to reduce subgraph load
 */
async function fetchActiveAuctions(
  first: number,
  skip: number,
  enrich: boolean
): Promise<EnrichedAuctionData[]> {
  const endpoint = getSubgraphEndpoint();
  
  const data = await request<{ listings: any[] }>(
    endpoint,
    ACTIVE_LISTINGS_QUERY,
    {
      first: Math.min(first, 1000),
      skip,
    }
  );

  // Filter out listings that are fully sold (even if subgraph hasn't marked them as finalized yet)
  // This ensures sold-out listings don't appear in active listings
  let activeListings = data.listings.filter((listing) => {
    const totalAvailable = parseInt(listing.totalAvailable || "0");
    const totalSold = parseInt(listing.totalSold || "0");
    const isFullySold = totalAvailable > 0 && totalSold >= totalAvailable;
    
    // Exclude if finalized or fully sold
    if (listing.finalized || isFullySold) {
      console.log(`[Active Listings] Filtering out listing ${listing.listingId}: finalized=${listing.finalized}, totalSold=${totalSold}, totalAvailable=${totalAvailable}, isFullySold=${isFullySold}`);
      return false;
    }
    
    return true;
  });
  
  console.log(`[Active Listings] Filtered ${data.listings.length} listings down to ${activeListings.length} active listings`);

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

        const enriched: EnrichedAuctionData = {
          ...listing,
          listingType: normalizeListingType(listing.listingType, listing),
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
        };

        return enriched;
      })
    );
  }

  return enrichedAuctions;
}

/**
 * Cached version of fetchActiveAuctions
 * Cache TTL: 60 seconds (data can be stale but will be refreshed client-side)
 * 
 * This function can be used both in API routes and server components
 */
export const getCachedActiveAuctions = unstable_cache(
  async (first: number, skip: number, enrich: boolean) => {
    return fetchActiveAuctions(first, skip, enrich);
  },
  ['active-auctions'],
  {
    revalidate: 60, // Cache for 60 seconds
    tags: ['auctions'], // Can be invalidated with revalidateTag
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

