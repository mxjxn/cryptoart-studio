import { request, gql } from "graphql-request";
import type { EnrichedAuctionData } from "~/lib/types";
import { fetchNFTMetadataCached } from "~/lib/server/nft-metadata-cache";
import { type Address } from "viem";
import { normalizeListingType, getHiddenUserAddresses } from "~/lib/server/auction";
import { discoverAndCacheUserBackground } from "~/lib/server/user-discovery";
import { getContractCreator } from "~/lib/contract-creator";
import { getListingPreviewsByIds } from "~/lib/server/listing-preview-store";
import {
  getListingMediaSnapshot,
  primeListingMediaSnapshot,
  resolveMediaWithFallback,
} from "~/lib/server/listing-metadata-refresh";
import {
  classifyMarketLifecycle,
  type MarketLifecycleTab,
} from "~/lib/market-lifecycle";

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

/** Thumbnail cache reads hit Postgres; without a ceiling a stuck query blocks the whole browse batch */
const THUMBNAIL_LOOKUP_TIMEOUT_MS = 2500;
const HIDDEN_USERS_TIMEOUT_MS = 3500;

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

async function getHiddenUserAddressesBounded(logLabel: string): Promise<Set<string>> {
  const t0 = Date.now();
  const raced = await Promise.race([
    getHiddenUserAddresses().then((set) => ({ ok: true as const, set })),
    new Promise<{ ok: false }>((resolve) =>
      setTimeout(() => resolve({ ok: false }), HIDDEN_USERS_TIMEOUT_MS)
    ),
  ]);
  const ms = Date.now() - t0;
  if (!raced.ok) {
    console.warn(`[${logLabel}] phase=hidden_users TIMEOUT — continuing without hidden-user filter`, {
      budgetMs: HIDDEN_USERS_TIMEOUT_MS,
    });
    return new Set();
  }
  console.log(`[${logLabel}] phase=hidden_users`, { ms, count: raced.set.size });
  return raced.set;
}

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
  /** When set (market tabs), over-fetches and filters by lifecycle; cancelled rows only appear in finished. */
  marketLifecycle?: MarketLifecycleTab;
}

function subgraphOrderByField(orderBy: string): string {
  if (orderBy === "listingId") return "listingId";
  if (orderBy === "updatedAt") return "updatedAt";
  return "createdAt";
}

function filterBrowseCandidateListings(
  listings: any[],
  hiddenAddresses: Set<string>,
  marketLifecycle?: MarketLifecycleTab
): any[] {
  const ONE_MONTH_IN_SECONDS = 30 * 24 * 60 * 60;
  return listings.filter((listing) => {
    if (!marketLifecycle && listing.status === "CANCELLED") return false;
    if (listing.seller && hiddenAddresses.has(listing.seller.toLowerCase())) {
      console.log(
        `[Browse Listings] Filtering out listing ${listing.listingId}: seller ${listing.seller} is hidden`
      );
      return false;
    }
    const startTime = parseInt(listing.startTime || "0", 10);
    const endTime = parseInt(listing.endTime || "0", 10);
    if (
      listing.listingType === "INDIVIDUAL_AUCTION" &&
      startTime === 0 &&
      endTime > ONE_MONTH_IN_SECONDS
    ) {
      console.log(
        `[Browse Listings] Filtering out listing ${listing.listingId}: start-on-first-bid auction with duration > 1 month (${Math.floor(endTime / 86400)} days)`
      );
      return false;
    }
    if (marketLifecycle && classifyMarketLifecycle(listing) !== marketLifecycle) {
      return false;
    }
    return true;
  });
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
    marketLifecycle,
  } = options;

  const endpoint = getSubgraphEndpoint();

  const lifecycleHeavySkip = !!marketLifecycle && skip > 0;
  const fetchCount = Math.min(
    marketLifecycle
      ? Math.max(Math.ceil(first * (lifecycleHeavySkip ? 8 : 5)), lifecycleHeavySkip ? 120 : 80)
      : Math.ceil(first * 1.5),
    marketLifecycle ? (lifecycleHeavySkip ? 300 : 200) : 100
  );
  
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
          orderBy: subgraphOrderByField(orderBy),
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
  const hiddenAddresses = await getHiddenUserAddressesBounded("Browse Listings");
  
  const activeListings = filterBrowseCandidateListings(
    data.listings,
    hiddenAddresses,
    marketLifecycle
  );

  let enrichedListings: EnrichedAuctionData[];

  if (!enrich) {
    enrichedListings = activeListings.map((listing) => {
      const bidCount = listing.bids?.length || 0;
      const highestBid =
        listing.bids && listing.bids.length > 0 ? listing.bids[0] : undefined;
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
      } as EnrichedAuctionData;
    });

    const previewMap = await getListingPreviewsByIds(
      enrichedListings.map((l) => String(l.listingId)),
    );
    enrichedListings = enrichedListings.map((l) => {
      const p = previewMap.get(String(l.listingId));
      if (!p?.imageUrl && !p?.thumbnailSmallUrl && !p?.title) return l;
      return {
        ...l,
        title: p.title ?? l.title,
        image: p.imageUrl ?? l.image,
        thumbnailUrl: p.thumbnailSmallUrl ?? p.imageUrl ?? l.thumbnailUrl,
      } as EnrichedAuctionData;
    });
  } else {
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
            const metadataPromise = fetchNFTMetadataCached(
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
        const mediaSnapshot = getListingMediaSnapshot(String(listing.listingId));
        
        if (imageUrl && listing.status !== "CANCELLED") {
          try {
            const cached = await lookupCachedThumbnailBounded(imageUrl);
            thumbnailUrl = cached ?? imageUrl;
          } catch {
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
            title: metadata?.title || metadata?.name || mediaSnapshot?.title,
            artist: metadata?.artist || metadata?.creator || mediaSnapshot?.artist,
            image: resolvedMedia.image,
            description: metadata?.description || mediaSnapshot?.description,
            thumbnailUrl: resolvedMedia.thumbnailUrl,
            metadata,
          };
          primeListingMediaSnapshot({
            ...listing,
            listingId: String(listing.listingId),
            title: metadata?.title || metadata?.name || mediaSnapshot?.title,
            artist: metadata?.artist || metadata?.creator || mediaSnapshot?.artist,
            description: metadata?.description || mediaSnapshot?.description,
            image: resolvedMedia.image,
            thumbnailUrl: resolvedMedia.thumbnailUrl,
          } as EnrichedAuctionData);
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
    marketLifecycle,
  } = options;

  const endpoint = getSubgraphEndpoint();
  const lifecycleHeavySkip = !!marketLifecycle && skip > 0;
  const fetchCount = Math.min(
    marketLifecycle
      ? Math.max(Math.ceil(first * (lifecycleHeavySkip ? 8 : 5)), lifecycleHeavySkip ? 120 : 80)
      : Math.ceil(first * 1.5),
    marketLifecycle ? (lifecycleHeavySkip ? 300 : 200) : 100
  );

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
          orderBy: subgraphOrderByField(orderBy),
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
  
  const hiddenAddresses = await getHiddenUserAddressesBounded("Browse Listings Streaming");

  const activeListings = filterBrowseCandidateListings(
    data.listings,
    hiddenAddresses,
    marketLifecycle
  );

  console.log("[Browse Listings Streaming] phase=filtered", {
    activeCount: activeListings.length,
    subgraphRawCount: data.listings.length,
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
    const batchStarted = Date.now();
    console.log("[Browse Listings Streaming] phase=batch_start", {
      batchOffset: i,
      batchSize: batch.length,
      listingIds: batch.map((l) => l.listingId),
    });

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
          const metadataPromise = fetchNFTMetadataCached(
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
      const mediaSnapshot = getListingMediaSnapshot(String(listing.listingId));
      
      if (imageUrl && listing.status !== "CANCELLED") {
        try {
          const cached = await lookupCachedThumbnailBounded(imageUrl);
          thumbnailUrl = cached ?? imageUrl;
        } catch {
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

      const enriched = {
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
        title: metadata?.title || metadata?.name || mediaSnapshot?.title,
        artist: metadata?.artist || metadata?.creator || mediaSnapshot?.artist,
        image: resolvedMedia.image,
        description: metadata?.description || mediaSnapshot?.description,
        thumbnailUrl: resolvedMedia.thumbnailUrl,
        metadata,
      };
      primeListingMediaSnapshot(enriched as EnrichedAuctionData);
      return enriched;
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

    console.log("[Browse Listings Streaming] phase=batch_done", {
      batchOffset: i,
      ms: Date.now() - batchStarted,
      settled: batchResults.length,
      yieldedTotal: yieldedCount,
    });
  }
}

