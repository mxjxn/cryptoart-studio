import { NextRequest, NextResponse } from "next/server";
import { request, gql } from "graphql-request";
import type { EnrichedAuctionData } from "~/lib/types";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import { type Address } from "viem";
import { normalizeListingType } from "~/lib/server/auction";

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
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
    
    // Future: support filtering by artist and listing type
    // const artist = searchParams.get("artist");
    // const listingType = searchParams.get("listingType");

    const endpoint = getSubgraphEndpoint();
    
    const data = await request<{ listings: any[] }>(
      endpoint,
      BROWSE_LISTINGS_QUERY,
      {
        first: Math.min(first, 100),
        skip,
        orderBy: orderBy === "listingId" ? "listingId" : "createdAt",
        orderDirection: orderDirection === "asc" ? "asc" : "desc",
      }
    );

    let enrichedListings: EnrichedAuctionData[] = data.listings;

    if (enrich) {
      enrichedListings = await Promise.all(
        data.listings.map(async (listing) => {
          const bidCount = listing.bids?.length || 0;
          const highestBid =
            listing.bids && listing.bids.length > 0
              ? listing.bids[0]
              : undefined;

          let metadata = null;
          if (listing.tokenAddress && listing.tokenId) {
            try {
              metadata = await fetchNFTMetadata(
                listing.tokenAddress as Address,
                listing.tokenId,
                listing.tokenSpec
              );
            } catch (error) {
              console.error(`Error fetching metadata:`, error);
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
    });
  } catch (error) {
    console.error("Error browsing listings:", error);
    
    return NextResponse.json(
      {
        success: false,
        listings: [],
        count: 0,
        error: error instanceof Error ? error.message : "Failed to browse listings",
      },
      { status: 500 }
    );
  }
}

