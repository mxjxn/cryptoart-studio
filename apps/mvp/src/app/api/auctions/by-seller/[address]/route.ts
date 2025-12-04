import { NextRequest, NextResponse } from "next/server";
import { request, gql } from "graphql-request";
import { unstable_cache } from "next/cache";
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

/**
 * Fetch and enrich auctions by seller from subgraph
 * This function is cached for 60 seconds to reduce subgraph load
 */
async function fetchAuctionsBySeller(
  normalizedSeller: string,
  first: number,
  skip: number,
  enrich: boolean
): Promise<EnrichedAuctionData[]> {
  const endpoint = getSubgraphEndpoint();

  console.log(`[BySeller] Fetching auctions for seller: ${normalizedSeller}`);
  console.log(`[BySeller] Using subgraph endpoint: ${endpoint}`);

  const data = await request<{ listings: any[] }>(
    endpoint,
    LISTINGS_BY_SELLER_QUERY,
    {
      seller: normalizedSeller,
      first: Math.min(first, 1000),
      skip,
    },
    getSubgraphHeaders()
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

        return enriched;
      })
    );
  }

  return enrichedAuctions;
}

/**
 * Cached version of fetchAuctionsBySeller
 * Cache TTL: 60 seconds to reduce subgraph rate limiting while maintaining freshness
 */
const getCachedAuctionsBySeller = unstable_cache(
  async (normalizedSeller: string, first: number, skip: number, enrich: boolean) => {
    return fetchAuctionsBySeller(normalizedSeller, first, skip, enrich);
  },
  ['auctions-by-seller'],
  {
    revalidate: 60, // Cache for 60 seconds
    tags: ['user-auctions'], // Can be invalidated with revalidateTag('user-auctions')
  }
);

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

    const normalizedSeller = address.toLowerCase();

    // Fetch cached auctions
    const enrichedAuctions = await getCachedAuctionsBySeller(
      normalizedSeller,
      first,
      skip,
      enrich
    );

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

