import { NextRequest, NextResponse } from "next/server";
import { request, gql } from "graphql-request";
import { getDatabase, userCache, eq, inArray } from '@cryptoart/db';
import { discoverAndCacheUsers } from "~/lib/server/user-discovery";

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

const RECENT_PURCHASES_QUERY = gql`
  query RecentPurchases($first: Int!) {
    purchases(
      first: $first
      orderBy: timestamp
      orderDirection: desc
    ) {
      buyer
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
    
    // Get recent purchases
    const purchasesData = await request<{ purchases: Array<{ buyer: string; timestamp: string }> }>(
      endpoint,
      RECENT_PURCHASES_QUERY,
      { first: first * 2 }, // Get more to find unique buyers
      getSubgraphHeaders()
    );

    // Get unique buyer addresses (most recent first)
    const buyerAddresses: string[] = [];
    const seen = new Set<string>();
    
    for (const purchase of purchasesData.purchases) {
      const normalized = purchase.buyer.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        buyerAddresses.push(normalized);
        if (buyerAddresses.length >= first) break;
      }
    }

    // Get user info for buyers
    const users = buyerAddresses.length > 0
      ? await db.select()
          .from(userCache)
          .where(
            inArray(userCache.ethAddress, buyerAddresses)
          )
      : [];

    // Find addresses that aren't in cache and discover them in background
    const missingAddresses = buyerAddresses.filter(
      address => !users.find(u => u.ethAddress.toLowerCase() === address.toLowerCase())
    );
    if (missingAddresses.length > 0) {
      // Discover missing users in background (non-blocking)
      discoverAndCacheUsers(missingAddresses, { failSilently: true }).catch((error) => {
        console.error("Error discovering missing collectors:", error);
      });
    }

    // Map buyers to user data
    const recentCollectors = buyerAddresses.map(address => {
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
      collectors: recentCollectors,
      count: recentCollectors.length,
    });
  } catch (error) {
    console.error("Error fetching recent collectors:", error);
    
    return NextResponse.json(
      {
        success: false,
        collectors: [],
        count: 0,
        error: error instanceof Error ? error.message : "Failed to fetch recent collectors",
      },
      { status: 500 }
    );
  }
}

