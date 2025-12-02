import { NextRequest, NextResponse } from "next/server";
import { request, gql } from "graphql-request";
import type { EnrichedAuctionData } from "~/lib/types";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import { type Address } from "viem";

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
};

const LISTINGS_BY_SELLER_QUERY = gql`
  query ListingsBySeller($seller: String!, $first: Int!, $skip: Int!) {
    listings(
      where: { seller: $seller }
      first: $first
      skip: $skip
      orderBy: createdAt
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(req.url);
    const first = parseInt(searchParams.get("first") || "100");
    const skip = parseInt(searchParams.get("skip") || "0");
    const enrich = searchParams.get("enrich") !== "false";

    if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      return NextResponse.json(
        { error: "Invalid seller address" },
        { status: 400 }
      );
    }

    const endpoint = getSubgraphEndpoint();
    const normalizedSeller = address.toLowerCase();

    console.log(`[BySeller] Fetching auctions for seller: ${normalizedSeller}`);
    console.log(`[BySeller] Using subgraph endpoint: ${endpoint}`);

    const data = await request<{ listings: any[] }>(
      endpoint,
      LISTINGS_BY_SELLER_QUERY,
      {
        seller: normalizedSeller,
        first: Math.min(first, 1000),
        skip,
      }
    );

    console.log(`[BySeller] Found ${data.listings?.length || 0} listings for seller ${normalizedSeller}`);

    let enrichedAuctions: EnrichedAuctionData[] = data.listings;

    if (enrich) {
      // Enrich auctions with metadata and bid information
      enrichedAuctions = await Promise.all(
        data.listings.map(async (listing) => {
          const bidCount = listing.bids?.length || 0;
          const highestBid =
            listing.bids && listing.bids.length > 0
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
              console.error(
                `Error fetching metadata for ${listing.tokenAddress}:${listing.tokenId}:`,
                error
              );
            }
          }

          const enriched: EnrichedAuctionData = {
            ...listing,
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

          return enriched;
        })
      );
    }

    return NextResponse.json({
      success: true,
      auctions: enrichedAuctions,
      count: enrichedAuctions.length,
    });
  } catch (error) {
    console.error("Error fetching auctions by seller:", error);

    return NextResponse.json(
      {
        success: false,
        auctions: [],
        count: 0,
        error:
          error instanceof Error ? error.message : "Failed to fetch auctions",
      },
      { status: 500 }
    );
  }
}

