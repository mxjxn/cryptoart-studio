import { request, gql } from "graphql-request";
import type { EnrichedAuctionData } from "~/lib/types";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import { type Address } from "viem";
import { normalizeListingType, getHiddenUserAddresses } from "~/lib/server/auction";
import { discoverAndCacheUserBackground } from "~/lib/server/user-discovery";
import { getContractCreator } from "~/lib/contract-creator";
import { getOrGenerateThumbnail } from "~/lib/server/thumbnail-generator";

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
};

/**
 * Get headers for subgraph requests, including API key if available
 */
const getSubgraphHeaders = (): Record<string, string> => {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
  return {};
};

const BROWSE_LISTINGS_QUERY = gql`
  query BrowseListings($first: Int!, $skip: Int!, $orderBy: String!, $orderDirection: String!) {
    listings(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
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

export interface BrowseListingsOptions {
  first?: number;
  skip?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  enrich?: boolean;
}

/**
 * Fetch and enrich listings from the subgraph
 * This is the core logic used by both the API route and server components
 */
export async function browseListings(
  options: BrowseListingsOptions = {}
): Promise<EnrichedAuctionData[]> {
  const {
    first = 20,
    skip = 0,
    orderBy = "listingId",
    orderDirection = "desc",
    enrich = true,
  } = options;

  const endpoint = getSubgraphEndpoint();
  
  const data = await request<{ listings: any[] }>(
    endpoint,
    BROWSE_LISTINGS_QUERY,
    {
      first: Math.min(first, 100),
      skip,
      orderBy: orderBy === "listingId" ? "listingId" : "createdAt",
      orderDirection: orderDirection === "asc" ? "asc" : "desc",
    },
    getSubgraphHeaders()
  );
  
  // Get hidden user addresses for filtering
  const hiddenAddresses = await getHiddenUserAddresses();
  
  // Filter out cancelled listings, sold-out listings, and hidden users
  const activeListings = data.listings.filter(listing => {
    // Exclude cancelled listings
    if (listing.status === "CANCELLED") {
      return false;
    }
    
    // Exclude finalized listings
    if (listing.finalized) {
      return false;
    }
    
    // Exclude sold-out listings (even if subgraph hasn't marked them as finalized yet)
    const totalAvailable = parseInt(listing.totalAvailable || "0");
    const totalSold = parseInt(listing.totalSold || "0");
    const isFullySold = totalAvailable > 0 && totalSold >= totalAvailable;
    
    if (isFullySold) {
      return false;
    }
    
    // Exclude listings from hidden users
    if (listing.seller && hiddenAddresses.has(listing.seller.toLowerCase())) {
      console.log(`[Browse Listings] Filtering out listing ${listing.listingId}: seller ${listing.seller} is hidden`);
      return false;
    }
    
    return true;
  });

  let enrichedListings: EnrichedAuctionData[] = activeListings;

  if (enrich) {
    // Collect all addresses that need user discovery
    const addressesToDiscover = new Set<string>();
    
    // Add seller addresses
    activeListings.forEach(listing => {
      if (listing.seller) {
        addressesToDiscover.add(listing.seller.toLowerCase());
      }
    });

    // Discover users for sellers (non-blocking background)
    addressesToDiscover.forEach(address => {
      discoverAndCacheUserBackground(address);
    });

    enrichedListings = await Promise.all(
      activeListings.map(async (listing) => {
        const bidCount = listing.bids?.length || 0;
        const highestBid =
          listing.bids && listing.bids.length > 0
            ? listing.bids[0]
            : undefined;

        // Discover contract creator if we have token info
        if (listing.tokenAddress && listing.tokenId) {
          try {
            const creatorResult = await getContractCreator(
              listing.tokenAddress,
              listing.tokenId
            );
            if (creatorResult.creator && creatorResult.creator.toLowerCase() !== listing.seller?.toLowerCase()) {
              // Discover creator in background (non-blocking)
              discoverAndCacheUserBackground(creatorResult.creator);
            }
          } catch {
            // Ignore creator discovery errors
          }
        }

        let metadata = null;
        if (listing.tokenAddress && listing.tokenId) {
          try {
            metadata = await fetchNFTMetadata(
              listing.tokenAddress as Address,
              listing.tokenId,
              listing.tokenSpec
            );
          } catch {
            // Ignore metadata fetch errors
          }
        }

        // Always generate a small thumbnail for consistency and reliability
        // This ensures all images are optimized and cached, preventing "no image" issues in embeds
        let thumbnailUrl: string | undefined = undefined;
        const imageUrl = metadata?.image;
        
        if (imageUrl) {
          try {
            // Always generate a small thumbnail (200x200) for consistency
            // This guarantees all images are optimized and cached, which helps with og-image embeds
            thumbnailUrl = await getOrGenerateThumbnail(imageUrl, 'small');
          } catch (error) {
            // If thumbnail generation fails, fall back to original image
            console.warn(`[Browse Listings] Failed to generate thumbnail for ${imageUrl}:`, error);
            thumbnailUrl = imageUrl;
          }
        }

        return {
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
          thumbnailUrl,
          metadata,
        };
      })
    );
  }

  return enrichedListings;
}

