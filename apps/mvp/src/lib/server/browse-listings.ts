import { gql } from "graphql-request";
import type { EnrichedAuctionData } from "~/lib/types";
import { fetchNFTMetadataCached } from "~/lib/server/nft-metadata-cache";
import { type Address } from "viem";
import {
  normalizeListingType,
  getHiddenUserAddresses,
  isListingBlockedFromProduct,
} from "~/lib/server/auction";
import { discoverAndCacheUserBackground } from "~/lib/server/user-discovery";
import { getContractCreator } from "~/lib/contract-creator";
import {
  getListingPreviewsByIds,
  makeListingPreviewId,
} from "~/lib/server/listing-preview-store";
import {
  getListingMediaSnapshot,
  primeListingMediaSnapshot,
  resolveMediaWithFallback,
} from "~/lib/server/listing-metadata-refresh";
import {
  classifyMarketLifecycle,
  type MarketLifecycleTab,
} from "~/lib/market-lifecycle";
import { BASE_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import {
  queryListingsAcrossChains,
  sortMergedListingsForBrowse,
} from "~/lib/server/subgraph-multi-query";

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

/**
 * When the DB has no small thumb yet, run the same on-demand path as `/api/auctions/[id]`
 * (bounded). Browse used to fall back to the raw metadata image; huge Arweave/IPFS originals
 * often break or time out in `next/image` on market cards.
 */
const THUMBNAIL_GENERATE_BUDGET_MS = 10_000;

async function tryGenerateSmallThumbnailBounded(imageUrl: string): Promise<string | null> {
  try {
    const { getOrGenerateThumbnail } = await import("./thumbnail-generator");
    return await Promise.race([
      getOrGenerateThumbnail(imageUrl, "small"),
      new Promise<string | null>((resolve) =>
        setTimeout(() => resolve(null), THUMBNAIL_GENERATE_BUDGET_MS)
      ),
    ]);
  } catch (e) {
    console.warn(
      `[Browse Listings] Small thumbnail generation failed for ${imageUrl.slice(0, 100)}…`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

function generateThumbnailBackground(imageUrl: string): void {
  tryGenerateSmallThumbnailBounded(imageUrl).catch(() => {});
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
    if (isListingBlockedFromProduct(listing, hiddenAddresses)) {
      return false;
    }
    if (!marketLifecycle && listing.status === "CANCELLED") return false;
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

function makeBasicListing(listing: any): EnrichedAuctionData {
  return {
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
  };
}

async function enrichSingleListing(listing: any): Promise<EnrichedAuctionData> {
  const bidCount = listing.bids?.length || 0;
  const highestBid =
    listing.bids && listing.bids.length > 0 ? listing.bids[0] : undefined;

  if (listing.tokenAddress && listing.tokenId) {
    try {
      const listingChain =
        typeof listing.chainId === "number" && Number.isFinite(listing.chainId)
          ? listing.chainId
          : BASE_CHAIN_ID;
      const creatorPromise = getContractCreator(
        listing.tokenAddress,
        listing.tokenId,
        { chainId: listingChain }
      );
      const timeoutPromise = new Promise<{ creator: Address | null; source: string | null }>((resolve) =>
        setTimeout(() => resolve({ creator: null, source: null }), 3000)
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.includes('timeout')) {
        console.warn(`[Browse Listings] Error fetching metadata for listing ${listing.listingId} (${listing.tokenAddress}:${listing.tokenId}):`, errorMsg);
      }
    }
  }

  let thumbnailUrl: string | undefined = undefined;
  const imageUrl = metadata?.image;
  const mediaSnapshot = getListingMediaSnapshot(String(listing.listingId));

  if (imageUrl && listing.status !== "CANCELLED") {
    try {
      const cached = await lookupCachedThumbnailBounded(imageUrl);
      if (cached) {
        thumbnailUrl = cached;
      } else {
        thumbnailUrl = imageUrl;
        generateThumbnailBackground(imageUrl);
      }
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
    title: metadata?.title || metadata?.name || mediaSnapshot?.title,
    artist: metadata?.artist || metadata?.creator || mediaSnapshot?.artist,
    image: resolvedMedia.image,
    description: metadata?.description || mediaSnapshot?.description,
    thumbnailUrl: resolvedMedia.thumbnailUrl,
    metadata,
  };

  primeListingMediaSnapshot({
    ...enriched,
    listingId: String(listing.listingId),
  });

  return enriched;
}

export interface BrowseListingsResult {
  listings: EnrichedAuctionData[];
  subgraphReturnedFullCount: boolean;
  subgraphDown?: boolean;
}

export type StreamingListingEvent = 
  | { type: 'listing'; data: EnrichedAuctionData }
  | { type: 'metadata'; subgraphReturnedFullCount?: boolean; subgraphDown?: boolean };

const inFlightBrowse = new Map<string, Promise<BrowseListingsResult>>();

function browseOptionsKey(options: BrowseListingsOptions): string {
  return JSON.stringify({
    first: options.first ?? 20,
    skip: options.skip ?? 0,
    orderBy: options.orderBy ?? "listingId",
    orderDirection: options.orderDirection ?? "desc",
    enrich: options.enrich ?? true,
    marketLifecycle: options.marketLifecycle ?? null,
  });
}

/**
 * Fetch and enrich listings from the subgraph
 * This is the core logic used by both the API route and server components
 */
export async function browseListings(
  options: BrowseListingsOptions = {}
): Promise<BrowseListingsResult> {
  const key = browseOptionsKey(options);
  const existing = inFlightBrowse.get(key);
  if (existing) return existing;

  const promise = browseListingsInner(options).finally(() => {
    inFlightBrowse.delete(key);
  });
  inFlightBrowse.set(key, promise);
  return promise;
}

async function browseListingsInner(
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

  const lifecycleHeavySkip = !!marketLifecycle && skip > 0;
  const fetchCount = Math.min(
    marketLifecycle
      ? Math.max(Math.ceil(first * (lifecycleHeavySkip ? 8 : 5)), lifecycleHeavySkip ? 120 : 80)
      : Math.ceil(first * 1.5),
    marketLifecycle ? (lifecycleHeavySkip ? 300 : 200) : 100
  );
  
  let mergedListings: any[] = [];
  let maxEndpointListingCount = 0;
  let anyEndpointSucceeded = false;
  try {
    console.log('[Browse Listings] Fetching from subgraphs:', {
      fetchCount,
      skip,
      orderBy,
      orderDirection,
    });

    const multi = await queryListingsAcrossChains(BROWSE_LISTINGS_QUERY, {
      first: fetchCount,
      skip,
      orderBy: subgraphOrderByField(orderBy),
      orderDirection: orderDirection === "asc" ? "asc" : "desc",
    });
    mergedListings = multi.listings;
    maxEndpointListingCount = multi.maxEndpointListingCount;
    anyEndpointSucceeded = multi.anyEndpointSucceeded;

    sortMergedListingsForBrowse(mergedListings, orderBy, orderDirection);

    console.log('[Browse Listings] Merged listings:', mergedListings.length);
  } catch (error: any) {
    // If all endpoints fail, mergedListings stays empty.
    console.error('[Browse Listings] Unexpected error while querying subgraphs:', error);
  }

  if (mergedListings.length === 0) {
    return {
      listings: [],
      subgraphReturnedFullCount: false,
      subgraphDown: !anyEndpointSucceeded,
    };
  }
  
  // Get hidden user addresses for filtering
  const hiddenAddresses = await getHiddenUserAddressesBounded("Browse Listings");
  
  const activeListings = filterBrowseCandidateListings(
    mergedListings,
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
      enrichedListings.map((l) =>
        makeListingPreviewId(l.chainId, String(l.listingId))
      ),
    );
    enrichedListings = enrichedListings.map((l) => {
      const p = previewMap.get(
        makeListingPreviewId(l.chainId, String(l.listingId))
      );
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
    
    const addressesToDiscover = new Set<string>();
    activeListings.forEach(listing => {
      if (listing.seller) {
        addressesToDiscover.add(listing.seller.toLowerCase());
      }
    });
    addressesToDiscover.forEach(address => {
      discoverAndCacheUserBackground(address);
    });

    const allResults = await Promise.allSettled(
      activeListings.map((listing) => enrichSingleListing(listing))
    );

    enrichedListings = allResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      const listing = activeListings[index];
      console.warn(`[Browse Listings] Enrichment failed for listing ${listing.listingId}, using basic data:`, result.reason);
      return makeBasicListing(listing);
    });
  }

  // Check if subgraph returned the full amount we requested
  // This helps determine if there might be more listings available
  const subgraphReturnedFullCount = maxEndpointListingCount >= fetchCount;
  
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

  const lifecycleHeavySkip = !!marketLifecycle && skip > 0;
  const fetchCount = Math.min(
    marketLifecycle
      ? Math.max(Math.ceil(first * (lifecycleHeavySkip ? 8 : 5)), lifecycleHeavySkip ? 120 : 80)
      : Math.ceil(first * 1.5),
    marketLifecycle ? (lifecycleHeavySkip ? 300 : 200) : 100
  );

  let mergedListings: any[] = [];
  let maxEndpointListingCount = 0;
  let anyEndpointSucceeded = false;
  try {
    const multi = await queryListingsAcrossChains(BROWSE_LISTINGS_QUERY, {
      first: fetchCount,
      skip,
      orderBy: subgraphOrderByField(orderBy),
      orderDirection: orderDirection === "asc" ? "asc" : "desc",
    });
    mergedListings = multi.listings;
    maxEndpointListingCount = multi.maxEndpointListingCount;
    anyEndpointSucceeded = multi.anyEndpointSucceeded;
    sortMergedListingsForBrowse(mergedListings, orderBy, orderDirection);

    console.log(
      "[Browse Listings Streaming] Merged listings:",
      mergedListings.length,
      "maxEndpointCount",
      maxEndpointListingCount
    );
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const isSubgraphDown =
      errorMessage.includes("bad indexers") ||
      errorMessage.includes("BadResponse") ||
      errorMessage.includes("ENOTFOUND") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ETIMEDOUT") ||
      errorMessage.includes("network");

    yield { type: "metadata", subgraphDown: isSubgraphDown };
    return;
  }

  if (mergedListings.length === 0) {
    yield { type: "metadata", subgraphDown: !anyEndpointSucceeded };
    return;
  }

  const hiddenAddresses = await getHiddenUserAddressesBounded("Browse Listings Streaming");

  const activeListings = filterBrowseCandidateListings(
    mergedListings,
    hiddenAddresses,
    marketLifecycle
  );

  console.log("[Browse Listings Streaming] phase=filtered", {
    activeCount: activeListings.length,
    subgraphRawCount: mergedListings.length,
  });

  const subgraphReturnedFullCount = maxEndpointListingCount >= fetchCount;
  yield { type: "metadata", subgraphReturnedFullCount, subgraphDown: false };

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

  const addressesToDiscover = new Set<string>();
  activeListings.forEach(listing => {
    if (listing.seller) {
      addressesToDiscover.add(listing.seller.toLowerCase());
    }
  });
  addressesToDiscover.forEach(address => {
    discoverAndCacheUserBackground(address);
  });

  const enrichStarted = Date.now();
  const allResults = await Promise.allSettled(
    activeListings.map((listing) => enrichSingleListing(listing))
  );
  console.log("[Browse Listings Streaming] phase=enrich_done", {
    ms: Date.now() - enrichStarted,
    total: activeListings.length,
  });

  let yieldedCount = 0;
  for (let i = 0; i < allResults.length && yieldedCount < first; i++) {
    const result = allResults[i];
    if (result.status === 'fulfilled') {
      yield { type: 'listing', data: result.value };
    } else {
      const listing = activeListings[i];
      console.warn(`[Browse Listings Streaming] Enrichment failed for listing ${listing.listingId}, using basic data:`, result.reason);
      yield { type: 'listing', data: makeBasicListing(listing) };
    }
    yieldedCount++;
  }
}

