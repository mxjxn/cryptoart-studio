import { NextRequest, NextResponse } from 'next/server';
import { request, gql } from 'graphql-request';
import { unstable_cache } from 'next/cache';
import { CHAIN_ID } from '~/lib/contracts/marketplace';
import { fetchNFTMetadata } from '~/lib/nft-metadata';
import type { EnrichedAuctionData } from '~/lib/types';
import { Address } from 'viem';
import { normalizeListingType } from '~/lib/server/auction';
import { discoverAndCacheUserBackground } from '~/lib/server/user-discovery';

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
 * Fetch and enrich auction data from subgraph
 * This function is cached for 2 minutes to reduce subgraph load
 */
async function fetchAuctionData(listingId: string): Promise<EnrichedAuctionData | null> {
  const endpoint = getSubgraphEndpoint();
  
  const data = await request<{ listing: any | null }>(
    endpoint,
    LISTING_BY_ID_QUERY,
    { id: listingId },
    getSubgraphHeaders()
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

    // Fetch cached auction data
    const enriched = await getCachedAuctionData(listingId);

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
  } catch (error) {
    console.error('Error fetching auction:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch auction',
      },
      { status: 500 }
    );
  }
}

