import { NextRequest, NextResponse } from 'next/server';
import { request, gql } from 'graphql-request';
import { unstable_cache } from 'next/cache';
import { CHAIN_ID } from '~/lib/contracts/marketplace';
import { fetchNFTMetadata } from '~/lib/nft-metadata';
import type { EnrichedAuctionData } from '~/lib/types';
import { Address } from 'viem';
import { normalizeListingType, normalizeTokenSpec } from '~/lib/server/auction';
import { discoverAndCacheUserBackground } from '~/lib/server/user-discovery';

// Set route timeout to 15 seconds (auction data may need more time)
export const maxDuration = 15;

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
async function fetchAuctionData(listingId: string): Promise<EnrichedAuctionData | null> {
  const endpoint = getSubgraphEndpoint();
  const headers = getSubgraphHeaders();
  
  // Use retry logic with exponential backoff for rate limiting
  let data = await retryWithBackoff(
    () => request<{ listing: any | null }>(
      endpoint,
      LISTING_BY_ID_QUERY,
      { id: listingId },
      headers
    ),
    3, // Max 3 retries
    1000 // Start with 1 second delay
  );

  let listing = data.listing;
  
  // Validate that the returned listing actually matches the requested listingId
  // This prevents issues where old cancelled listings might be returned for the same NFT
  if (listing) {
    const returnedListingId = String(listing.listingId || listing.id || '');
    const requestedListingId = String(listingId);
    
    if (returnedListingId !== requestedListingId) {
      console.warn(`[fetchAuctionData] Listing ID mismatch with entity id query! Requested: ${requestedListingId}, Got: ${returnedListingId}, Entity ID: ${listing.id}, Status: ${listing.status}`);
      // Try querying by listingId field instead
      const listingIdNum = parseInt(listingId);
      if (!isNaN(listingIdNum)) {
        try {
          const listingData = await request<{ listings: any[] }>(
            endpoint,
            LISTING_BY_LISTING_ID_QUERY,
            { listingId: listingIdNum },
            headers
          );
          
          if (listingData.listings && listingData.listings.length > 0) {
            listing = listingData.listings[0];
            const newReturnedListingId = String(listing.listingId || listing.id || '');
            if (newReturnedListingId === requestedListingId) {
              console.log(`[fetchAuctionData] Found correct listing using listingId query: listingId=${listing.listingId}, status=${listing.status}`);
            } else {
              console.error(`[fetchAuctionData] Still got wrong listing! Requested: ${requestedListingId}, Got: ${newReturnedListingId}`);
              return null;
            }
          } else {
            console.warn(`[fetchAuctionData] No listing found using listingId query for: ${listingId}`);
            return null;
          }
        } catch (error) {
          console.error(`[fetchAuctionData] Fallback query failed:`, error);
          return null;
        }
      } else {
        console.error(`[fetchAuctionData] Invalid listingId format: ${listingId}`);
        return null;
      }
    }
  }

  if (!listing) {
    // Try fallback query by listingId field
    const listingIdNum = parseInt(listingId);
    if (!isNaN(listingIdNum)) {
      try {
        const listingData = await request<{ listings: any[] }>(
          endpoint,
          LISTING_BY_LISTING_ID_QUERY,
          { listingId: listingIdNum },
          headers
        );
        
        if (listingData.listings && listingData.listings.length > 0) {
          listing = listingData.listings[0];
          console.log(`[fetchAuctionData] Found listing using listingId query fallback: listingId=${listing.listingId}, status=${listing.status}`);
        }
      } catch (error) {
        console.error(`[fetchAuctionData] Fallback query also failed:`, error);
      }
    }
    
    if (!listing) {
      return null;
    }
  }
  
  const bidCount = listing.bids?.length || 0;
  const highestBid = listing.bids && listing.bids.length > 0 
    ? listing.bids[0] // Already sorted by amount desc
    : undefined;

  // Metadata + optional supply reads in parallel (was sequential and could exceed client timeouts).
  const metadataPromise =
    listing.tokenAddress && listing.tokenId
      ? fetchNFTMetadata(
          listing.tokenAddress as Address,
          listing.tokenId,
          listing.tokenSpec
        ).catch((error) => {
          console.error(
            `Error fetching metadata for ${listing.tokenAddress}:${listing.tokenId}:`,
            error
          );
          return null;
        })
      : Promise.resolve(null);

  const erc1155Promise =
    (listing.tokenSpec === "ERC1155" || listing.tokenSpec === 2) &&
    listing.tokenAddress &&
    listing.tokenId
      ? import("~/lib/server/erc1155-supply").then(async ({ getERC1155TotalSupply }) => {
          try {
            const totalSupply = await getERC1155TotalSupply(
              listing.tokenAddress,
              listing.tokenId
            );
            return totalSupply !== null ? totalSupply.toString() : undefined;
          } catch (error: any) {
            const errorMsg = error?.message || String(error);
            console.error(
              `[fetchAuctionData] Error fetching ERC1155 total supply for ${listing.tokenAddress}:${listing.tokenId}:`,
              errorMsg
            );
            return undefined;
          }
        })
      : Promise.resolve(undefined);

  const erc721Promise =
    (listing.tokenSpec === "ERC721" || listing.tokenSpec === 1) && listing.tokenAddress
      ? import("~/lib/erc721-supply").then(async ({ fetchERC721TotalSupply }) => {
          try {
            const totalSupply = await fetchERC721TotalSupply(listing.tokenAddress);
            return totalSupply !== null ? totalSupply : undefined;
          } catch (error: any) {
            const errorMsg = error?.message || String(error);
            console.error(
              `[fetchAuctionData] Error fetching ERC721 total supply for ${listing.tokenAddress}:`,
              errorMsg
            );
            return undefined;
          }
        })
      : Promise.resolve(undefined);

  const [metadata, erc1155TotalSupply, erc721TotalSupply] = await Promise.all([
    metadataPromise,
    erc1155Promise,
    erc721Promise,
  ]);

  let thumbnailUrl: string | undefined = undefined;
  if (metadata?.image) {
    try {
      const { getOrGenerateThumbnail } = await import("~/lib/server/thumbnail-generator");
      thumbnailUrl = await getOrGenerateThumbnail(metadata.image, "small");
    } catch (error) {
      console.warn(
        `[fetchAuctionData] Failed to generate thumbnail for ${metadata.image}:`,
        error
      );
      thumbnailUrl = metadata.image;
    }
  }

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
    title: metadata?.title || metadata?.name,
    artist: metadata?.artist || metadata?.creator,
    image: metadata?.image,
    thumbnailUrl,
    description: metadata?.description,
    metadata,
    erc1155TotalSupply,
    erc721TotalSupply,
  };

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
  async (listingId: string, _mediaEnvKey: string) => {
    return fetchAuctionData(listingId);
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
    const timeoutMs = forceRefresh ? 16000 : 12000;
    const loadPromise = forceRefresh
      ? fetchAuctionData(listingId)
      : getCachedAuctionData(listingId, auctionFetchCacheIdentity());

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

    const enriched = outcome.data;
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

