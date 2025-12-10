import { NextRequest, NextResponse } from "next/server";
import { request, gql } from "graphql-request";

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error(
    "Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL"
  );
};

const CHECK_TOKEN_LISTING_QUERY = gql`
  query CheckTokenListing($tokenAddress: String!, $tokenId: String!) {
    listings(
      where: {
        tokenAddress: $tokenAddress
        tokenId: $tokenId
        status: "ACTIVE"
        finalized: false
      }
      first: 10
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      listingId
      seller
      tokenAddress
      tokenId
      tokenSpec
      totalAvailable
      totalSold
      status
      finalized
    }
  }
`;

/**
 * Check if a token is already listed or sold
 * 
 * GET /api/listings/check-token?tokenAddress=0x...&tokenId=123
 * 
 * Returns: {
 *   isListed: boolean,
 *   isSold: boolean,
 *   activeListings: Array<{ listingId: string, seller: string, totalAvailable: number, totalSold: number }>
 * }
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const tokenAddress = searchParams.get("tokenAddress");
    const tokenId = searchParams.get("tokenId");

    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/i.test(tokenAddress)) {
      return NextResponse.json(
        { error: "Invalid token address format" },
        { status: 400 }
      );
    }

    if (!tokenId) {
      return NextResponse.json(
        { error: "Token ID is required" },
        { status: 400 }
      );
    }

    try {
      const endpoint = getSubgraphEndpoint();
      const data = await request<{
        listings: Array<{
          id: string;
          listingId: string;
          seller: string;
          tokenAddress: string;
          tokenId: string;
          tokenSpec: string | number;
          totalAvailable: number;
          totalSold: number;
          status: string;
          finalized: boolean;
        }>;
      }>(endpoint, CHECK_TOKEN_LISTING_QUERY, {
        tokenAddress: tokenAddress.toLowerCase(),
        tokenId: tokenId,
      });

      const activeListings = data.listings || [];
      
      // Check if any listing is sold out
      const isSold = activeListings.some(
        (listing) => listing.totalSold >= listing.totalAvailable
      );

      // Check if there are any active listings
      const isListed = activeListings.length > 0;

      return NextResponse.json({
        isListed,
        isSold,
        activeListings: activeListings.map((listing) => ({
          listingId: listing.listingId,
          seller: listing.seller,
          totalAvailable: listing.totalAvailable,
          totalSold: listing.totalSold,
          tokenSpec: listing.tokenSpec,
        })),
      });
    } catch (subgraphError) {
      console.error("Error querying subgraph:", subgraphError);
      // If subgraph fails, assume token is not listed (fail open)
      // This prevents blocking users if subgraph is down
      return NextResponse.json({
        isListed: false,
        isSold: false,
        activeListings: [],
        error: "Subgraph query failed, assuming token is available",
      });
    }
  } catch (error) {
    console.error("Error checking token listing:", error);
    return NextResponse.json(
      {
        error: "Failed to check token listing",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
