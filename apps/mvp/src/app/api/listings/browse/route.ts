import { NextRequest, NextResponse } from "next/server";
import { request, gql } from "graphql-request";
import type { EnrichedAuctionData } from "~/lib/types";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import { type Address } from "viem";
import { normalizeListingType } from "~/lib/server/auction";
import { discoverAndCacheUserBackground, discoverAndCacheUsers } from "~/lib/server/user-discovery";
import { getContractCreator } from "~/lib/contract-creator";

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const first = parseInt(searchParams.get("first") || "20");
    const skip = parseInt(searchParams.get("skip") || "0");
    const enrich = searchParams.get("enrich") !== "false";
    
    // Default order by listingId descending (newest first)
    // Future: support orderBy query param (listingId, createdAt, etc.)
    const orderBy = searchParams.get("orderBy") || "listingId";
    const orderDirection = searchParams.get("orderDirection") || "desc";
    
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
    
    // Filter out cancelled listings and sold-out listings
    // Sold-out listings are those where totalSold >= totalAvailable
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
            metadata,
          };
        })
      );
    }

    return NextResponse.json({
      success: true,
      listings: enrichedListings,
      count: enrichedListings.length,
      pagination: {
        first,
        skip,
        hasMore: enrichedListings.length === first,
      },
    }, {
      headers: {
        // Add HTTP cache headers for CDN/edge caching
        // Cache for 30 seconds, allow stale for 60 seconds while revalidating
        // This dramatically reduces disk IO by serving cached responses from the edge
        // Note: This cache can be invalidated via revalidatePath('/api/listings/browse')
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to browse listings";
    console.error("[API /listings/browse] Error:", errorMessage, error);
    
    return NextResponse.json(
      {
        success: false,
        listings: [],
        count: 0,
        error: errorMessage,
      },
      { status: 200 } // Return 200 so client can handle gracefully
    );
  }
}

