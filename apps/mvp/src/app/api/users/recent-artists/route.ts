import { NextRequest, NextResponse } from "next/server";
import { request, gql } from "graphql-request";
import { getDatabase, userCache, contractCache, eq, inArray } from '@cryptoart/db';
import { discoverAndCacheUsers } from "~/lib/server/user-discovery";

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
};

const RECENT_LISTINGS_QUERY = gql`
  query RecentListings($first: Int!) {
    listings(
      where: { status: "ACTIVE", finalized: false }
      first: $first
      orderBy: createdAt
      orderDirection: desc
    ) {
      tokenAddress
    }
  }
`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const first = parseInt(searchParams.get("first") || "6");

    const endpoint = getSubgraphEndpoint();
    const db = getDatabase();
    
    // Get recent listings to find their creators
    const listingsData = await request<{ listings: Array<{ tokenAddress: string }> }>(
      endpoint,
      RECENT_LISTINGS_QUERY,
      { first: 50 } // Get more listings to find unique creators
    );

    // Get unique contract addresses
    const contractAddresses = Array.from(
      new Set(listingsData.listings.map(l => l.tokenAddress.toLowerCase()))
    );

    // Query contractCache to find creators
    const contracts = await db.select()
      .from(contractCache)
      .where(
        inArray(contractCache.contractAddress, contractAddresses)
      );

    // Get unique creator addresses
    const creatorAddresses = Array.from(
      new Set(
        contracts
          .filter(c => c.creatorAddress)
          .map(c => c.creatorAddress!.toLowerCase())
      )
    ).slice(0, first);

    // Get user info for creators
    const users = creatorAddresses.length > 0
      ? await db.select()
          .from(userCache)
          .where(
            inArray(userCache.ethAddress, creatorAddresses)
          )
      : [];

    // Find addresses that aren't in cache and discover them in background
    const missingAddresses = creatorAddresses.filter(
      address => !users.find(u => u.ethAddress.toLowerCase() === address.toLowerCase())
    );
    if (missingAddresses.length > 0) {
      // Discover missing users in background (non-blocking)
      discoverAndCacheUsers(missingAddresses, { failSilently: true }).catch((error) => {
        console.error("Error discovering missing artists:", error);
      });
    }

    // Map creators to user data
    const recentArtists = creatorAddresses.map(address => {
      const user = users.find(u => u.ethAddress.toLowerCase() === address.toLowerCase());
      return {
        address,
        username: user?.username || null,
        displayName: user?.displayName || null,
        pfpUrl: user?.pfpUrl || null,
      };
    });

    return NextResponse.json({
      success: true,
      artists: recentArtists,
      count: recentArtists.length,
    });
  } catch (error) {
    console.error("Error fetching recent artists:", error);
    
    return NextResponse.json(
      {
        success: false,
        artists: [],
        count: 0,
        error: error instanceof Error ? error.message : "Failed to fetch recent artists",
      },
      { status: 500 }
    );
  }
}

