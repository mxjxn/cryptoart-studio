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

const LISTINGS_WITH_BIDS_QUERY = gql`
  query ListingsWithBids($bidder: String!, $first: Int!, $skip: Int!) {
    bids(
      where: { bidder: $bidder }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      listing {
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
      }
      amount
      timestamp
    }
  }
`;

/**
 * Fetch and enrich auctions with bids from subgraph
 * This function is cached for 60 seconds to reduce subgraph load
 */
async function fetchAuctionsWithBids(
  normalizedBidder: string,
  first: number,
  skip: number,
  enrich: boolean
): Promise<EnrichedAuctionData[]> {
  const endpoint = getSubgraphEndpoint();

  const data = await request<{ bids: any[] }>(
    endpoint,
    LISTINGS_WITH_BIDS_QUERY,
    {
      bidder: normalizedBidder,
      first: Math.min(first, 1000),
      skip,
    },
    getSubgraphHeaders()
  );

  // Extract unique listings from bids (a user might have multiple bids on same listing)
  const listingMap = new Map<string, any>();
  const bidMap = new Map<string, any>(); // Track highest bid per listing

  for (const bid of data.bids) {
    if (!bid.listing) continue;

    const listingId = bid.listing.id;
    const existingBid = bidMap.get(listingId);

    // Keep the highest bid for each listing
    if (
      !existingBid ||
      BigInt(bid.amount) > BigInt(existingBid.amount)
    ) {
      bidMap.set(listingId, bid);
      listingMap.set(listingId, bid.listing);
    }
  }

  const uniqueListings = Array.from(listingMap.values());

  let enrichedAuctions: EnrichedAuctionData[] = uniqueListings;

  if (enrich) {
    // Enrich auctions with metadata and bid information
    enrichedAuctions = await Promise.all(
      uniqueListings.map(async (listing) => {
        // Get all bids for this listing to calculate bidCount and highestBid
        const listingBids = data.bids
          .filter((bid) => bid.listing?.id === listing.id)
          .sort((a, b) => {
            const amountA = BigInt(a.amount);
            const amountB = BigInt(b.amount);
            return amountA > amountB ? -1 : amountA < amountB ? 1 : 0;
          });

        const bidCount = listingBids.length;
        const highestBid = listingBids.length > 0 ? listingBids[0] : undefined;
        const userBid = bidMap.get(listing.id);

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
          // Store user's bid amount as currentPrice for display
          currentPrice: userBid?.amount,
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
 * Cached version of fetchAuctionsWithBids
 * Cache TTL: 60 seconds to reduce subgraph rate limiting while maintaining freshness
 */
const getCachedAuctionsWithBids = unstable_cache(
  async (normalizedBidder: string, first: number, skip: number, enrich: boolean) => {
    return fetchAuctionsWithBids(normalizedBidder, first, skip, enrich);
  },
  ['auctions-with-bids'],
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
        { error: "Invalid bidder address" },
        { status: 400 }
      );
    }

    const normalizedBidder = address.toLowerCase();

    // Fetch cached auctions
    const enrichedAuctions = await getCachedAuctionsWithBids(
      normalizedBidder,
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
    console.error("Error fetching auctions with bids:", error);

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

