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

export interface BrowseListingsResult {
  listings: EnrichedAuctionData[];
  subgraphReturnedFullCount: boolean; // Whether the subgraph returned the full amount we requested
}

/**
 * Fetch and enrich listings from the subgraph
 * This is the core logic used by both the API route and server components
 */
export async function browseListings(
  options: BrowseListingsOptions = {}
): Promise<BrowseListingsResult> {
  const {
    first = 20,
    skip = 0,
    orderBy = "listingId",
    orderDirection = "desc",
    enrich = true,
  } = options;

  const endpoint = getSubgraphEndpoint();
  
  // Fetch more listings than requested to account for filtering
  // We'll filter out cancelled, finalized, sold-out, and hidden listings
  // So we need to fetch extra to ensure we have enough after filtering
  const fetchCount = Math.min(Math.ceil(first * 1.5), 100); // Fetch 50% more, capped at 100
  
  let data: { listings: any[] };
  try {
    console.log('[Browse Listings] Fetching from subgraph:', { endpoint, fetchCount, skip, orderBy, orderDirection });
    data = await request<{ listings: any[] }>(
      endpoint,
      BROWSE_LISTINGS_QUERY,
      {
        first: fetchCount,
        skip,
        orderBy: orderBy === "listingId" ? "listingId" : "createdAt",
        orderDirection: orderDirection === "asc" ? "asc" : "desc",
      },
      getSubgraphHeaders()
    );
    console.log('[Browse Listings] Subgraph returned', data.listings?.length || 0, 'listings');
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error('[Browse Listings] Subgraph error:', errorMessage, error);
    // Return empty result instead of throwing - let client handle gracefully
    return {
      listings: [],
      subgraphReturnedFullCount: false,
    };
  }
  
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
    console.log('[Browse Listings] Enriching', activeListings.length, 'listings');
    
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
          } catch (error) {
            // Log but don't throw - metadata is optional
            console.warn(`[Browse Listings] Error fetching metadata for ${listing.tokenAddress}:${listing.tokenId}:`, error instanceof Error ? error.message : String(error));
          }
        }

        // Check for thumbnail - use cached if available, otherwise use original image
        // Background generation should have created thumbnails by the time users view listings
        // If not ready yet, we use the original image to avoid blocking page load
        let thumbnailUrl: string | undefined = undefined;
        const imageUrl = metadata?.image;
        
        if (imageUrl) {
          try {
            const { getCachedThumbnail } = await import('./thumbnail-cache');
            const { getThumbnailStatus } = await import('./background-thumbnails');
            
            // Check if thumbnail is already cached (ready)
            const cached = await getCachedThumbnail(imageUrl, 'small');
            if (cached) {
              thumbnailUrl = cached;
            } else {
              // Check if thumbnail is being generated
              const status = await getThumbnailStatus(imageUrl, 'small');
              if (status === 'generating') {
                // Thumbnail is being generated in background, use original image for now
                thumbnailUrl = imageUrl;
              } else {
                // Not cached and not generating - try to generate on-demand (fallback)
                // This handles cases where background generation failed or hasn't run yet
                try {
                  thumbnailUrl = await getOrGenerateThumbnail(imageUrl, 'small');
                } catch (error) {
                  // If generation fails, fall back to original image
                  console.warn(`[Browse Listings] Failed to generate thumbnail for ${imageUrl}:`, error);
                  thumbnailUrl = imageUrl;
                }
              }
            }
          } catch (error) {
            // If anything fails, use original image
            console.warn(`[Browse Listings] Error checking thumbnail for ${imageUrl}:`, error);
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

  // Check if subgraph returned the full amount we requested
  // This helps determine if there might be more listings available
  const subgraphReturnedFullCount = data.listings.length === fetchCount;
  
  const finalListings = enrichedListings.slice(0, first);
  console.log('[Browse Listings] Returning', finalListings.length, 'listings (requested', first, ', filtered from', activeListings.length, 'active)');
  
  // Return only the requested number of listings
  // This ensures we don't return more than requested, and helps with hasMore calculation
  return {
    listings: finalListings,
    subgraphReturnedFullCount,
  };
}

