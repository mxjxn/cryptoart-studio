import { NextRequest, NextResponse } from 'next/server';
import { request, gql } from 'graphql-request';
import { unstable_cache } from 'next/cache';
import { CHAIN_ID } from '~/lib/contracts/marketplace';
import { fetchNFTMetadata } from '~/lib/nft-metadata';
import type { EnrichedAuctionData } from '~/lib/types';
import { Address } from 'viem';
import { normalizeListingType, normalizeTokenSpec } from '~/lib/server/auction';
import { discoverAndCacheUserBackground } from '~/lib/server/user-discovery';
import { withTimeout } from '~/lib/utils';

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
  const data = await retryWithBackoff(
    () => request<{ listing: any | null }>(
      endpoint,
      LISTING_BY_ID_QUERY,
      { id: listingId },
      headers
    ),
    3, // Max 3 retries
    1000 // Start with 1 second delay
  );

  if (!data.listing) {
    return null;
  }

  const listing = data.listing;
  
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
      console.error(`[fetchAuctionData] Error fetching ERC1155 total supply for ${listing.tokenAddress}:${listing.tokenId}:`, errorMsg);
      // Continue without total supply - listing will still work
    }
  }

  // Fetch ERC721 collection total supply if applicable
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
      console.error(`[fetchAuctionData] Error fetching ERC721 total supply for ${listing.tokenAddress}:`, errorMsg);
      // Continue without total supply - listing will still work
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
    description: metadata?.description,
    metadata,
    erc1155TotalSupply,
    erc721TotalSupply,
  };

  return enriched;
}

/**
 * Cached version of fetchAuctionData
 * Cache TTL: 2 minutes (120 seconds) to reduce subgraph rate limiting
 * Cache key includes listingId automatically via function parameter
 */
const getCachedAuctionData = unstable_cache(
  async (listingId: string) => {
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

    // Fetch cached auction data with timeout to prevent hanging
    const enriched = await withTimeout(
      getCachedAuctionData(listingId),
      10000, // 10 second timeout
      null // Fallback to null on timeout
    );

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

    return NextResponse.json({
      success: true,
      auction: enriched,
    });
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

