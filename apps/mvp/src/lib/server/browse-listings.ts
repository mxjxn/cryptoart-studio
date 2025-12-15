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

/**
 * Retry a subgraph request with exponential backoff
 * Handles transient errors like "bad indexers" from The Graph Network
 */
async function retrySubgraphRequest<T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      
      // Check if this is a retryable error
      const isRetryable = 
        errorMessage.includes('bad indexers') ||
        errorMessage.includes('BadResponse') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT');
      
      if (!isRetryable || attempt === maxRetries) {
        // Not retryable or out of retries
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`[Browse Listings] Subgraph request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, errorMessage);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

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
  subgraphDown?: boolean; // Whether the subgraph is down/unavailable
}

export type StreamingListingEvent = 
  | { type: 'listing'; data: EnrichedAuctionData }
  | { type: 'metadata'; subgraphReturnedFullCount?: boolean; subgraphDown?: boolean };

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
  // We'll filter out cancelled and hidden listings
  // Finalized and sold-out listings are included in recent listings
  // So we need to fetch extra to ensure we have enough after filtering
  const fetchCount = Math.min(Math.ceil(first * 1.5), 100); // Fetch 50% more, capped at 100
  
  let data: { listings: any[] };
  try {
    console.log('[Browse Listings] Fetching from subgraph:', { endpoint, fetchCount, skip, orderBy, orderDirection });
    
    // Use retry logic for subgraph requests to handle transient errors
    data = await retrySubgraphRequest(async () => {
      return await request<{ listings: any[] }>(
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
    });
    
    console.log('[Browse Listings] Subgraph returned', data.listings?.length || 0, 'listings');
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error('[Browse Listings] Subgraph error after retries:', errorMessage, {
      endpoint,
      errorType: error?.constructor?.name,
      stack: error?.stack?.substring(0, 500),
    });
    
    // Detect if this is a subgraph availability issue
    const isSubgraphDown = 
      errorMessage.includes('bad indexers') ||
      errorMessage.includes('BadResponse') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('network') ||
      error?.response?.errors?.some((e: any) => 
        e.message?.includes('bad indexers') || 
        e.message?.includes('indexer')
      );
    
    // Return empty result with subgraph status - let client handle gracefully
    return {
      listings: [],
      subgraphReturnedFullCount: false,
      subgraphDown: isSubgraphDown,
    };
  }
  
  // Get hidden user addresses for filtering
  const hiddenAddresses = await getHiddenUserAddresses();
  
  // Filter out cancelled listings, hidden users, and problematic auctions
  // Include finalized and sold-out listings in recent listings
  const activeListings = data.listings.filter(listing => {
    // Exclude cancelled listings
    if (listing.status === "CANCELLED") {
      return false;
    }
    
    // Exclude listings from hidden users
    if (listing.seller && hiddenAddresses.has(listing.seller.toLowerCase())) {
      console.log(`[Browse Listings] Filtering out listing ${listing.listingId}: seller ${listing.seller} is hidden`);
      return false;
    }
    
    // Exclude start-on-first-bid auctions with duration > 1 month (problematic 180-day auctions)
    // These are auctions that were created with the bug before the fix
    const startTime = parseInt(listing.startTime || "0", 10);
    const endTime = parseInt(listing.endTime || "0", 10);
    const ONE_MONTH_IN_SECONDS = 30 * 24 * 60 * 60; // 2592000 seconds
    
    if (listing.listingType === "INDIVIDUAL_AUCTION" && 
        startTime === 0 && 
        endTime > ONE_MONTH_IN_SECONDS) {
      console.log(`[Browse Listings] Filtering out listing ${listing.listingId}: start-on-first-bid auction with duration > 1 month (${Math.floor(endTime / 86400)} days)`);
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

    // Process listings in smaller batches to allow incremental progress
    // This prevents one slow listing from blocking all others
    // Reduced batch size for faster initial results
    const BATCH_SIZE = 3; // Process 3 listings at a time for faster streaming
    const batches: EnrichedAuctionData[] = [];
    
    for (let i = 0; i < activeListings.length; i += BATCH_SIZE) {
      const batch = activeListings.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (listing) => {
        const bidCount = listing.bids?.length || 0;
        const highestBid =
          listing.bids && listing.bids.length > 0
            ? listing.bids[0]
            : undefined;

        // Discover contract creator if we have token info
        // OPTIMIZED: Run with timeout to avoid blocking on slow onchain calls
        // getContractCreator already checks cache first, so this should be fast
        if (listing.tokenAddress && listing.tokenId) {
          try {
            // Add timeout to avoid blocking on slow onchain calls
            const creatorPromise = getContractCreator(
              listing.tokenAddress,
              listing.tokenId
            );
            const timeoutPromise = new Promise<{ creator: Address | null; source: string | null }>((resolve) => 
              setTimeout(() => resolve({ creator: null, source: null }), 3000) // 3 second timeout
            );
            const creatorResult = await Promise.race([creatorPromise, timeoutPromise]);
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
            // Add timeout to metadata fetching to prevent hanging
            // Reduced timeout to 5 seconds for faster page loads
            // Use Promise.race to timeout after 5 seconds
            const metadataPromise = fetchNFTMetadata(
              listing.tokenAddress as Address,
              listing.tokenId,
              listing.tokenSpec
            );
            const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Metadata fetch timeout after 5s')), 5000)
            );
            metadata = await Promise.race([metadataPromise, timeoutPromise]);
          } catch (error) {
            // Log but don't throw - metadata is optional
            // Include listing ID and status in error log for debugging
            const errorMsg = error instanceof Error ? error.message : String(error);
            // Only log timeout errors at debug level to reduce noise
            if (!errorMsg.includes('timeout')) {
              console.warn(`[Browse Listings] Error fetching metadata for listing ${listing.listingId} (${listing.tokenAddress}:${listing.tokenId}):`, errorMsg);
            }
          }
        }

        // Check for thumbnail - use cached if available, otherwise use original image
        // OPTIMIZATION: Skip on-demand generation to avoid blocking page load
        // Background generation should have created thumbnails by the time users view listings
        // If not ready yet, we use the original image to avoid blocking page load
        // Skip thumbnail generation for cancelled listings
        let thumbnailUrl: string | undefined = undefined;
        const imageUrl = metadata?.image;
        
        if (imageUrl && listing.status !== "CANCELLED") {
          try {
            const { getCachedThumbnail } = await import('./thumbnail-cache');
            
            // OPTIMIZED: Only check cache - skip on-demand generation to avoid blocking
            // This ensures fast page loads even if thumbnails aren't ready yet
            // The original image will be used temporarily, and thumbnails will be ready on next load
            const cached = await getCachedThumbnail(imageUrl, 'small');
            if (cached) {
              thumbnailUrl = cached;
            } else {
              // Not cached - use original image to avoid blocking page load
              // Background generation will create thumbnail for next load
              thumbnailUrl = imageUrl;
            }
          } catch (error) {
            // If anything fails, use original image
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
      
      // Process batch results - include successful enrichments, fallback to basic data for failures
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          batches.push(result.value);
        } else {
          // If enrichment failed, return basic listing data
          const listing = batch[index];
          console.warn(`[Browse Listings] Enrichment failed for listing ${listing.listingId}, using basic data:`, result.reason);
          batches.push({
            ...listing,
            listingType: normalizeListingType(listing.listingType, listing),
            bidCount: listing.bids?.length || 0,
            highestBid: listing.bids && listing.bids.length > 0
              ? {
                  amount: listing.bids[0].amount,
                  bidder: listing.bids[0].bidder,
                  timestamp: listing.bids[0].timestamp,
                }
              : undefined,
          });
        }
      });
    }
    
    enrichedListings = batches;
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
    subgraphDown: false, // Subgraph is working if we got here
  };
}

/**
 * Streaming version that yields listings as they're enriched
 * This allows the client to start rendering listings before all are ready
 */
export async function* browseListingsStreaming(
  options: BrowseListingsOptions = {}
): AsyncGenerator<StreamingListingEvent, void, unknown> {
  const {
    first = 20,
    skip = 0,
    orderBy = "listingId",
    orderDirection = "desc",
    enrich = true,
  } = options;

  const endpoint = getSubgraphEndpoint();
  const fetchCount = Math.min(Math.ceil(first * 1.5), 100);
  
  let data: { listings: any[] };
  try {
    console.log('[Browse Listings Streaming] Fetching from subgraph:', { endpoint, fetchCount, skip, orderBy, orderDirection });
    
    data = await retrySubgraphRequest(async () => {
      return await request<{ listings: any[] }>(
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
    });
    
    console.log('[Browse Listings Streaming] Subgraph returned', data.listings?.length || 0, 'listings');
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const isSubgraphDown = 
      errorMessage.includes('bad indexers') ||
      errorMessage.includes('BadResponse') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('network');
    
    yield { type: 'metadata', subgraphDown: isSubgraphDown };
    return;
  }
  
  const hiddenAddresses = await getHiddenUserAddresses();
  const ONE_MONTH_IN_SECONDS = 30 * 24 * 60 * 60; // 2592000 seconds
  
  const activeListings = data.listings.filter(listing => {
    if (listing.status === "CANCELLED") return false;
    if (listing.seller && hiddenAddresses.has(listing.seller.toLowerCase())) {
      console.log(`[Browse Listings Streaming] Filtering out listing ${listing.listingId}: seller ${listing.seller} is hidden`);
      return false;
    }
    
    // Exclude start-on-first-bid auctions with duration > 1 month (problematic 180-day auctions)
    const startTime = parseInt(listing.startTime || "0", 10);
    const endTime = parseInt(listing.endTime || "0", 10);
    
    if (listing.listingType === "INDIVIDUAL_AUCTION" && 
        startTime === 0 && 
        endTime > ONE_MONTH_IN_SECONDS) {
      console.log(`[Browse Listings Streaming] Filtering out listing ${listing.listingId}: start-on-first-bid auction with duration > 1 month (${Math.floor(endTime / 86400)} days)`);
      return false;
    }
    
    return true;
  });

  // Yield metadata first
  const subgraphReturnedFullCount = data.listings.length === fetchCount;
  yield { type: 'metadata', subgraphReturnedFullCount, subgraphDown: false };

  if (!enrich) {
    // If not enriching, yield all listings immediately
    for (const listing of activeListings.slice(0, first)) {
      yield {
        type: 'listing',
        data: {
          ...listing,
          listingType: normalizeListingType(listing.listingType, listing),
          bidCount: listing.bids?.length || 0,
          highestBid: listing.bids && listing.bids.length > 0
            ? {
                amount: listing.bids[0].amount,
                bidder: listing.bids[0].bidder,
                timestamp: listing.bids[0].timestamp,
              }
            : undefined,
        },
      };
    }
    return;
  }

  // Collect addresses for user discovery (non-blocking)
  const addressesToDiscover = new Set<string>();
  activeListings.forEach(listing => {
    if (listing.seller) {
      addressesToDiscover.add(listing.seller.toLowerCase());
    }
  });
  addressesToDiscover.forEach(address => {
    discoverAndCacheUserBackground(address);
  });

  // Process and yield listings in batches as they're enriched
  const BATCH_SIZE = 5;
  let yieldedCount = 0;
  
  for (let i = 0; i < activeListings.length && yieldedCount < first; i += BATCH_SIZE) {
    const batch = activeListings.slice(i, i + BATCH_SIZE);
    
    // Process batch in parallel
    const batchPromises = batch.map(async (listing) => {
      const bidCount = listing.bids?.length || 0;
      const highestBid = listing.bids && listing.bids.length > 0 ? listing.bids[0] : undefined;

      // Discover contract creator (non-blocking with timeout)
      // OPTIMIZED: Add timeout to avoid blocking on slow onchain calls
      // getContractCreator already checks cache first, so this should be fast
      if (listing.tokenAddress && listing.tokenId) {
        try {
          const creatorPromise = getContractCreator(listing.tokenAddress, listing.tokenId);
          const timeoutPromise = new Promise<{ creator: Address | null; source: string | null }>((resolve) => 
            setTimeout(() => resolve({ creator: null, source: null }), 3000) // 3 second timeout
          );
          const creatorResult = await Promise.race([creatorPromise, timeoutPromise]);
          if (creatorResult.creator && creatorResult.creator.toLowerCase() !== listing.seller?.toLowerCase()) {
            discoverAndCacheUserBackground(creatorResult.creator);
          }
        } catch {
          // Ignore creator discovery errors
        }
      }

      let metadata = null;
      if (listing.tokenAddress && listing.tokenId) {
        try {
          // Add timeout to metadata fetching to prevent hanging
          // Reduced timeout to 5 seconds for faster page loads
          // Use Promise.race to timeout after 5 seconds
          const metadataPromise = fetchNFTMetadata(
            listing.tokenAddress as Address,
            listing.tokenId,
            listing.tokenSpec
          );
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Metadata fetch timeout after 5s')), 5000)
          );
          metadata = await Promise.race([metadataPromise, timeoutPromise]);
        } catch (error) {
          // Log but don't throw - metadata is optional
          // Only log non-timeout errors to reduce noise
          const errorMsg = error instanceof Error ? error.message : String(error);
          if (!errorMsg.includes('timeout')) {
            console.warn(`[Browse Listings Streaming] Error fetching metadata for listing ${listing.listingId} (${listing.tokenAddress}:${listing.tokenId}):`, errorMsg);
          }
        }
      }

      // OPTIMIZED: Only check cache - skip on-demand generation to avoid blocking
      // This ensures fast streaming even if thumbnails aren't ready yet
      let thumbnailUrl: string | undefined = undefined;
      const imageUrl = metadata?.image;
      
      if (imageUrl && listing.status !== "CANCELLED") {
        try {
          const { getCachedThumbnail } = await import('./thumbnail-cache');
          
          // Only check cache - skip on-demand generation to avoid blocking
          const cached = await getCachedThumbnail(imageUrl, 'small');
          if (cached) {
            thumbnailUrl = cached;
          } else {
            // Not cached - use original image to avoid blocking
            // Background generation will create thumbnail for next load
            thumbnailUrl = imageUrl;
          }
        } catch (error) {
          // If anything fails, use original image
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
    });

    // Wait for batch to complete and yield each listing as it's ready
    const batchResults = await Promise.allSettled(batchPromises);
    
    for (const result of batchResults) {
      if (yieldedCount >= first) break;
      
      if (result.status === 'fulfilled') {
        yield { type: 'listing', data: result.value };
        yieldedCount++;
      } else {
        // If enrichment failed, yield basic listing data
        const listing = batch[batchResults.indexOf(result)];
        console.warn(`[Browse Listings Streaming] Enrichment failed for listing ${listing.listingId}, using basic data:`, result.reason);
        yield {
          type: 'listing',
          data: {
            ...listing,
            listingType: normalizeListingType(listing.listingType, listing),
            bidCount: listing.bids?.length || 0,
            highestBid: listing.bids && listing.bids.length > 0
              ? {
                  amount: listing.bids[0].amount,
                  bidder: listing.bids[0].bidder,
                  timestamp: listing.bids[0].timestamp,
                }
              : undefined,
          },
        };
        yieldedCount++;
      }
    }
  }
}

