import { NextRequest, NextResponse } from "next/server";
import { request, gql } from "graphql-request";
import { getDatabase, userCache, eq, inArray } from '@cryptoart/db';

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
};

const RECENT_BIDS_QUERY = gql`
  query RecentBids($first: Int!) {
    bids(
      first: $first
      orderBy: timestamp
      orderDirection: desc
    ) {
      bidder
      timestamp
    }
  }
`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const first = parseInt(searchParams.get("first") || "6");

    const endpoint = getSubgraphEndpoint();
    const db = getDatabase();
    
    // Get recent bids
    const bidsData = await request<{ bids: Array<{ bidder: string; timestamp: string }> }>(
      endpoint,
      RECENT_BIDS_QUERY,
      { first: first * 2 } // Get more to find unique bidders
    );

    // Get unique bidder addresses (most recent first)
    const bidderAddresses: string[] = [];
    const seen = new Set<string>();
    
    for (const bid of bidsData.bids) {
      const normalized = bid.bidder.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        bidderAddresses.push(normalized);
        if (bidderAddresses.length >= first) break;
      }
    }

    // Get user info for bidders
    const users = bidderAddresses.length > 0
      ? await db.select()
          .from(userCache)
          .where(
            inArray(userCache.ethAddress, bidderAddresses)
          )
      : [];

    // Map bidders to user data
    const recentBidders = bidderAddresses.map(address => {
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
      bidders: recentBidders,
      count: recentBidders.length,
    });
  } catch (error) {
    console.error("Error fetching recent bidders:", error);
    
    return NextResponse.json(
      {
        success: false,
        bidders: [],
        count: 0,
        error: error instanceof Error ? error.message : "Failed to fetch recent bidders",
      },
      { status: 500 }
    );
  }
}

