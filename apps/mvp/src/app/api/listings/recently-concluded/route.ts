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

const RECENTLY_CONCLUDED_QUERY = gql`
  query RecentlyConcluded($since: BigInt!, $first: Int!, $skip: Int!) {
    listings(
      where: { 
        status: "FINALIZED"
        finalized: true
        updatedAt_gte: $since
      }
      first: $first
      skip: $skip
      orderBy: updatedAt
      orderDirection: desc
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
    const first = parseInt(searchParams.get("first") || "8");
    const skip = parseInt(searchParams.get("skip") || "0");
    const enrich = searchParams.get("enrich") !== "false";

    // Get listings finalized within the last 7 days
    // Use updatedAt (BigInt timestamp in seconds) for filtering
    const oneWeekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    
    const endpoint = getSubgraphEndpoint();
    
    const data = await request<{ listings: any[] }>(
      endpoint,
      RECENTLY_CONCLUDED_QUERY,
      {
        since: oneWeekAgo.toString(),
        first: Math.min(first, 100),
        skip,
      },
      getSubgraphHeaders()
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
    });
  } catch (error) {
    console.error("Error fetching recently concluded listings:", error);
    
    return NextResponse.json(
      {
        success: false,
        listings: [],
        count: 0,
        error: error instanceof Error ? error.message : "Failed to fetch recently concluded listings",
      },
      { status: 500 }
    );
  }
}

