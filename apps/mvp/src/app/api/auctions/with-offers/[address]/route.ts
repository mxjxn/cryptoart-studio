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

const LISTINGS_WITH_OFFERS_QUERY = gql`
  query ListingsWithOffers($offerer: String!, $first: Int!, $skip: Int!) {
    offers(
      where: { offerer: $offerer, status: "PENDING" }
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
 * Fetch and enrich auctions with offers from subgraph
 * This function is cached for 60 seconds to reduce subgraph load
 */
async function fetchAuctionsWithOffers(
  normalizedOfferer: string,
  first: number,
  skip: number,
  enrich: boolean
): Promise<EnrichedAuctionData[]> {
  const endpoint = getSubgraphEndpoint();

  const data = await request<{ offers: any[] }>(
    endpoint,
    LISTINGS_WITH_OFFERS_QUERY,
    {
      offerer: normalizedOfferer,
      first: Math.min(first, 1000),
      skip,
    },
    getSubgraphHeaders()
  );

  // Extract unique listings from offers (a user might have multiple offers on same listing)
  const listingMap = new Map<string, any>();
  const offerMap = new Map<string, any>(); // Track highest offer per listing

  for (const offer of data.offers) {
    if (!offer.listing) continue;

    const listingId = offer.listing.id;
    const existingOffer = offerMap.get(listingId);

    // Keep the highest offer for each listing
    if (
      !existingOffer ||
      BigInt(offer.amount) > BigInt(existingOffer.amount)
    ) {
      offerMap.set(listingId, offer);
      listingMap.set(listingId, offer.listing);
    }
  }

  const uniqueListings = Array.from(listingMap.values());

  // Filter out cancelled listings
  const activeListings = uniqueListings.filter((listing) => listing.status !== "CANCELLED");

  let enrichedAuctions: EnrichedAuctionData[] = activeListings;

  if (enrich) {
    // Enrich auctions with metadata and offer information
    enrichedAuctions = await Promise.all(
      uniqueListings.map(async (listing) => {
        // Get all offers for this listing to calculate offerCount and highestOffer
        const listingOffers = data.offers
          .filter((offer) => offer.listing?.id === listing.id)
          .sort((a, b) => {
            const amountA = BigInt(a.amount);
            const amountB = BigInt(b.amount);
            return amountA > amountB ? -1 : amountA < amountB ? 1 : 0;
          });

        const offerCount = listingOffers.length;
        const highestOffer = listingOffers.length > 0 ? listingOffers[0] : undefined;
        const userOffer = offerMap.get(listing.id);

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
          // Store user's offer amount as currentPrice for display
          currentPrice: userOffer?.amount,
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
 * Cached version of fetchAuctionsWithOffers
 * Cache TTL: 60 seconds to reduce subgraph rate limiting while maintaining freshness
 */
const getCachedAuctionsWithOffers = unstable_cache(
  async (normalizedOfferer: string, first: number, skip: number, enrich: boolean) => {
    return fetchAuctionsWithOffers(normalizedOfferer, first, skip, enrich);
  },
  ['auctions-with-offers'],
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
        { error: "Invalid offerer address" },
        { status: 400 }
      );
    }

    const normalizedOfferer = address.toLowerCase();

    // Fetch cached auctions
    const enrichedAuctions = await getCachedAuctionsWithOffers(
      normalizedOfferer,
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
    console.error("Error fetching auctions with offers:", error);

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


