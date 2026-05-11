import { NextRequest, NextResponse } from 'next/server';
import { request, gql } from 'graphql-request';
import { unstable_cache } from 'next/cache';
import { pickDisplayTitle } from '~/lib/metadata-display';
import type { EnrichedAuctionData } from '~/lib/types';
import {
  getConfiguredSubgraphEndpoints,
} from "~/lib/server/subgraph-endpoints";
import { enrichListingMediaAndSupplyCapped } from "~/lib/server/listing-enrichment-capped";
import {
  getHiddenUserAddresses,
  isListingBlockedFromProduct,
  normalizeListingType,
  normalizeTokenSpec,
} from '~/lib/server/auction';
import { makeListingPreviewId, upsertListingPreview } from '~/lib/server/listing-preview-store';
import { discoverAndCacheUserBackground } from '~/lib/server/user-discovery';
import {
  AmbiguousListingError,
  chainIdsFromSubgraphRows,
  isAmbiguousListingError,
} from '~/lib/auction-errors';

// Mainnet metadata + IPFS + cold thumbnail work often exceeds 12–15s; keep headroom below typical platform caps.
export const maxDuration = 60;

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

const LISTING_BY_ID_QUERY = gql`
  query ListingById($id: ID!) {
    listing(id: $id) {
      id
      listingId
      chainId
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
      chainId
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
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is a rate limit error (429 or similar)
 */
function isRateLimitError(error: any): boolean {
  if (!error) return false;
  
  // Check for HTTP 429 status
  if (error.response?.status === 429) return true;
  
  // Check for rate limit in error message
  const errorMessage = error.message?.toLowerCase() || '';
  if (errorMessage.includes('rate limit') || 
      errorMessage.includes('too many requests') ||
      errorMessage.includes('429')) {
    return true;
  }
  
  // Check for rate limit in GraphQL errors
  if (error.response?.errors) {
    for (const gqlError of error.response.errors) {
      const msg = gqlError.message?.toLowerCase() || '';
      if (msg.includes('rate limit') || msg.includes('too many requests')) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param initialDelay - Initial delay in ms (default: 1000)
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on rate limit errors
      if (!isRateLimitError(error) || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate exponential backoff delay
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(
        `[fetchAuctionData] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`
      );
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Fetch and enrich auction data from subgraph
 * This function is cached for 2 minutes to reduce subgraph load
 * Includes retry logic with exponential backoff for rate limiting
 */
async function fetchAuctionData(
  listingId: string,
  chainId?: number
): Promise<EnrichedAuctionData | null> {
  const headers = getSubgraphHeaders();

  const configured = getConfiguredSubgraphEndpoints();
  const endpoints =
    chainId == null
      ? configured
      : configured.filter((e) => e.chainId === chainId);
  if (chainId != null && endpoints.length === 0) {
    return null;
  }
  const listingIdNum = parseInt(listingId, 10);
  const isNumeric = !Number.isNaN(listingIdNum);

  const settled = await Promise.allSettled(
    endpoints.map((ep) =>
      retryWithBackoff(
        async () => {
          if (isNumeric) {
            return await request<{ listings: any[] }>(
              ep.url,
              LISTING_BY_LISTING_ID_QUERY,
              { listingId: listingIdNum },
              headers
            );
          }

          const r = await request<{ listing: any | null }>(
            ep.url,
            LISTING_BY_ID_QUERY,
            { id: listingId },
            headers
          );
          return { listings: r.listing ? [r.listing] : [] };
        },
        3,
        1000
      )
    )
  );

  const matched: any[] = [];
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    matched.push(...(s.value.listings ?? []));
  }

  if (matched.length === 0) return null;
  if (matched.length > 1) {
    throw new AmbiguousListingError(listingId, chainIdsFromSubgraphRows(matched));
  }

  const listing = matched[0];

  const hiddenSellers = await getHiddenUserAddresses();
  if (isListingBlockedFromProduct(listing, hiddenSellers)) {
    console.warn(
      `[fetchAuctionData] Blocked listing ${listingId} — hidden/blocked seller or BLOCKED_LISTING_IDS; skipping enrichment`
    );
    return null;
  }

  const bidCount = listing.bids?.length || 0;
  const highestBid = listing.bids && listing.bids.length > 0 
    ? listing.bids[0] // Already sorted by amount desc
    : undefined;

  const {
    metadata,
    erc1155TotalSupply,
    erc721TotalSupply,
    thumbnailUrl,
    detailThumbnailUrl,
  } = await enrichListingMediaAndSupplyCapped(listing, {
    listingIdForLog: listingId,
    requestChainId: chainId,
  });

  // Normalize listing type and token spec for consistent handling
  const normalizedListingType = normalizeListingType(listing.listingType, listing);
  const normalizedTokenSpec = normalizeTokenSpec(listing.tokenSpec);
  
  // Debug logging for listing type and token spec normalization
  console.log(`[fetchAuctionData] Listing ${listingId} normalization:`, {
    rawListingType: listing.listingType,
    rawListingTypeType: typeof listing.listingType,
    normalizedListingType,
    rawTokenSpec: listing.tokenSpec,
    rawTokenSpecType: typeof listing.tokenSpec,
    normalizedTokenSpec,
    lazy: listing.lazy,
  });

  const enriched: EnrichedAuctionData = {
    ...listing,
    listingType: normalizedListingType,
    tokenSpec: normalizedTokenSpec,
    bidCount,
    highestBid: highestBid ? {
      amount: highestBid.amount,
      bidder: highestBid.bidder,
      timestamp: highestBid.timestamp,
    } : undefined,
    // Include full bid history for auction detail pages
    bids: listing.bids || [],
    title: pickDisplayTitle(metadata) ?? metadata?.title ?? metadata?.name,
    artist: metadata?.artist || metadata?.creator,
    image: metadata?.image,
    thumbnailUrl,
    detailThumbnailUrl,
    description: metadata?.description,
    metadata,
    erc1155TotalSupply,
    erc721TotalSupply,
  };

  if (metadata?.image || enriched.title) {
    void upsertListingPreview({
      listingId: makeListingPreviewId(listing.chainId, String(listing.listingId)),
      tokenAddress: String(listing.tokenAddress),
      tokenId: String(listing.tokenId),
      imageUrl: metadata?.image ?? null,
      thumbnailSmallUrl: thumbnailUrl ?? null,
      title: enriched.title ?? null,
    });
  }

  return enriched;
}

/** Bust Data Cache when gateway / access token env changes (avoids stale "no image" payloads). */
function auctionFetchCacheIdentity(): string {
  return [
    process.env.PINATA_GATEWAY_URL || '',
    process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL || '',
    process.env.PINATA_GATEWAY_ACCESS_TOKEN || '',
    process.env.PINATA_GATEWAY_KEY || '',
    'v4',
  ].join('|');
}

/**
 * Cached version of fetchAuctionData
 * Cache TTL: 2 minutes (120 seconds) to reduce subgraph rate limiting
 * Second arg is part of the cache key so media env changes invalidate entries.
 */
const getCachedAuctionData = unstable_cache(
  async (listingId: string, chainId: number | null, _mediaEnvKey: string) => {
    return fetchAuctionData(listingId, chainId ?? undefined);
  },
  ['auction-data'],
  {
    revalidate: 120, // Cache for 2 minutes (120 seconds)
    tags: ['auction'], // Can be invalidated with revalidateTag('auction')
  }
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;
    
    if (!listingId) {
      return NextResponse.json(
        { error: 'Listing ID is required' },
        { status: 400 }
      );
    }

    // `useAuction` passes `?refresh=` on forced refetch — bypass stale `unstable_cache`
    // so metadata/IPFS enrichment can complete (slow gateways may exceed short timeouts).
    const forceRefresh = req.nextUrl.searchParams.has('refresh');
    const chainIdParam = req.nextUrl.searchParams.get('chainId');
    const chainId =
      chainIdParam != null && chainIdParam.trim() !== ""
        ? (() => {
            const v = parseInt(chainIdParam, 10);
            return Number.isNaN(v) ? null : v;
          })()
        : null;

    if (chainIdParam != null && chainId == null) {
      return NextResponse.json(
        { error: "Invalid chainId query param" },
        { status: 400 }
      );
    }
    // Inner enrichment is capped (~14s metadata bundle + ~8s thumbs). Route budget must cover
    // slow subgraph cold starts plus that cap (subgraph is not individually timed here).
    const timeoutMs = forceRefresh || chainId != null ? 45_000 : 18_000;
    // Never cache unscoped lookups: a second chain can later mint the same listingId and
    // a stale cached single-chain response would be wrong until TTL expires.
    const loadPromise =
      forceRefresh || chainId == null
        ? fetchAuctionData(listingId, chainId ?? undefined)
        : getCachedAuctionData(listingId, chainId, auctionFetchCacheIdentity());

    type RaceOk = { kind: 'ok'; data: EnrichedAuctionData | null };
    type RaceTimeout = { kind: 'timeout' };
    type RaceErr = { kind: 'err'; err: unknown };

    const outcome = await Promise.race([
      loadPromise
        .then((data): RaceOk => ({ kind: 'ok', data }))
        .catch((err): RaceErr => ({ kind: 'err', err })),
      new Promise<RaceTimeout>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs)),
    ]);

    if (outcome.kind === 'timeout') {
      console.warn(
        `[auctions/${listingId}] Enrichment exceeded ${timeoutMs}ms — returning 504 (not 404)`
      );
      return NextResponse.json(
        {
          success: false,
          error: 'Auction lookup timed out',
          code: 'TIMEOUT',
        },
        { status: 504 }
      );
    }

    if (outcome.kind === 'err') {
      throw outcome.err;
    }

    let enriched = outcome.data;
    // Cached path can hold `null` for ~120s from a pre-index miss. Page-status may already
    // report `ready` (subgraph-only). Retry uncached once so listing pages recover without
    // waiting for the negative cache entry to expire.
    if (!enriched && !forceRefresh) {
      console.warn(
        `[auctions/${listingId}] Cached auction was null — one uncached retry (stale negative cache / indexer race)`
      );
      const retryOutcome = await Promise.race([
        fetchAuctionData(listingId, chainId ?? undefined)
          .then((data): RaceOk => ({ kind: 'ok', data }))
          .catch((err): RaceErr => ({ kind: 'err', err })),
        new Promise<RaceTimeout>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs)),
      ]);
      if (retryOutcome.kind === 'timeout') {
        console.warn(
          `[auctions/${listingId}] Uncached retry exceeded ${timeoutMs}ms — returning 504`
        );
        return NextResponse.json(
          {
            success: false,
            error: 'Auction lookup timed out',
            code: 'TIMEOUT',
          },
          { status: 504 }
        );
      }
      if (retryOutcome.kind === 'err') {
        throw retryOutcome.err;
      }
      enriched = retryOutcome.data;
    }

    if (!enriched) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    // Discover seller and all bidders in background (validate addresses first, wrapped in try-catch to not block response)
    // This runs after returning the response to avoid blocking
    try {
      if (enriched.seller && /^0x[a-fA-F0-9]{40}$/i.test(enriched.seller)) {
        discoverAndCacheUserBackground(enriched.seller);
      }
      // Note: We need to fetch bids from the listing to discover bidders
      // Since we're using cached data, we'll need to get bids separately if needed
      // For now, user discovery will happen on cache miss or when data is fresh
    } catch (error) {
      // Don't let user discovery errors break the API response
      console.error('[auctions API] Error in background user discovery:', error);
    }

    return NextResponse.json(
      {
        success: true,
        auction: enriched,
      },
      forceRefresh ? { headers: { 'Cache-Control': 'no-store, max-age=0' } } : {}
    );
  } catch (error: any) {
    console.error('Error fetching auction:', error);
    
    if (isAmbiguousListingError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          chains: error.chains,
        },
        { status: 409 }
      );
    }
    if (error?.status === 409) {
      return NextResponse.json(
        {
          success: false,
          error: error?.message || "Ambiguous listingId",
          code: error?.code || "AMBIGUOUS_LISTING_ID",
          chains: Array.isArray(error?.chains) ? error.chains : [],
        },
        { status: 409 }
      );
    }
    
    // Check if it's a rate limit error
    if (isRateLimitError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limited. Please try again in a moment.',
        },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch auction',
      },
      { status: 500 }
    );
  }
}

