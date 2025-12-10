import { NextRequest, NextResponse } from "next/server";
import { request, gql } from "graphql-request";
import { getDatabase, userCache, inArray } from '@cryptoart/db';
import { discoverAndCacheUsers } from "~/lib/server/user-discovery";

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
};

const getSubgraphHeaders = (): Record<string, string> => {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
  return {};
};

const TOP_BUYERS_QUERY = gql`
  query TopBuyers($first: Int!) {
    purchases(
      first: $first
      orderBy: timestamp
      orderDirection: desc
    ) {
      buyer
      amount
      count
      timestamp
    }
  }
`;

const TOP_SELLERS_QUERY = gql`
  query TopSellers($first: Int!) {
    purchases(
      first: $first
      orderBy: timestamp
      orderDirection: desc
    ) {
      listingId
      amount
      count
    }
    listings(
      where: { status: "FINALIZED" }
      first: $first
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      seller
      totalSold
    }
  }
`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const endpoint = getSubgraphEndpoint();
    const db = getDatabase();

    // Fetch purchases and listings in parallel
    const [buyersPurchasesData, sellersData] = await Promise.all([
      request<{
        purchases: Array<{
          buyer: string;
          amount: string;
          count: number;
          timestamp: string;
        }>;
      }>(
        endpoint,
        TOP_BUYERS_QUERY,
        { first: limit * 50 }, // Get more to aggregate properly
        getSubgraphHeaders()
      ),
      request<{
        purchases: Array<{
          listingId: string;
          amount: string;
          count: number;
        }>;
        listings: Array<{
          id: string;
          seller: string;
          totalSold: string;
        }>;
      }>(
        endpoint,
        TOP_SELLERS_QUERY,
        { first: limit * 50 }, // Get more to aggregate properly
        getSubgraphHeaders()
      ),
    ]);

    // Aggregate buyers: sum amounts and count artworks
    const buyerMap = new Map<string, {
      address: string;
      totalSpent: bigint;
      artworkCount: number;
    }>();

    for (const purchase of buyersPurchasesData.purchases) {
      const buyerLower = purchase.buyer.toLowerCase();
      const amount = BigInt(purchase.amount);
      const count = purchase.count;

      const existing = buyerMap.get(buyerLower);
      if (existing) {
        existing.totalSpent += amount;
        existing.artworkCount += count;
      } else {
        buyerMap.set(buyerLower, {
          address: purchase.buyer,
          totalSpent: amount,
          artworkCount: count,
        });
      }
    }

    // Aggregate sellers: use purchases to calculate revenue, listings to count artworks
    // First, create a map of listingId -> seller from finalized listings
    const listingSellerMap = new Map<string, string>();
    const sellerListingCount = new Map<string, number>();

    for (const listing of sellersData.listings) {
      const sellerLower = listing.seller.toLowerCase();
      listingSellerMap.set(listing.id, listing.seller);
      
      // Count listings per seller
      const count = sellerListingCount.get(sellerLower) || 0;
      sellerListingCount.set(sellerLower, count + 1);
    }

    // Aggregate seller revenue from purchases
    const sellerMap = new Map<string, {
      address: string;
      totalSold: bigint;
      artworkCount: number;
    }>();

    for (const purchase of sellersData.purchases) {
      const seller = listingSellerMap.get(purchase.listingId);
      if (!seller) continue; // Skip if listing not found or not finalized

      const sellerLower = seller.toLowerCase();
      const amount = BigInt(purchase.amount);
      const count = purchase.count;

      const existing = sellerMap.get(sellerLower);
      if (existing) {
        existing.totalSold += amount;
        existing.artworkCount += count;
      } else {
        // Use listing count for artwork count, purchase count for sold items
        sellerMap.set(sellerLower, {
          address: seller,
          totalSold: amount,
          artworkCount: count, // Count of items sold from purchases
        });
      }
    }

    // Merge listing counts for sellers who might not have purchases in our query
    for (const [sellerLower, listingCount] of sellerListingCount.entries()) {
      const seller = sellersData.listings.find(l => l.seller.toLowerCase() === sellerLower)?.seller;
      if (!seller) continue;

      const existing = sellerMap.get(sellerLower);
      if (existing) {
        // Use max of purchase count and listing count
        existing.artworkCount = Math.max(existing.artworkCount, listingCount);
      } else {
        sellerMap.set(sellerLower, {
          address: seller,
          totalSold: BigInt(0),
          artworkCount: listingCount,
        });
      }
    }

    // Get top buyers and sellers
    const topBuyers = Array.from(buyerMap.values())
      .sort((a, b) => {
        // Sort by total spent descending
        if (b.totalSpent > a.totalSpent) return 1;
        if (b.totalSpent < a.totalSpent) return -1;
        return 0;
      })
      .slice(0, limit)
      .map(b => ({
        address: b.address,
        totalSpent: b.totalSpent.toString(),
        artworkCount: b.artworkCount,
      }));

    const topSellers = Array.from(sellerMap.values())
      .sort((a, b) => {
        // Sort by total sold descending
        if (b.totalSold > a.totalSold) return 1;
        if (b.totalSold < a.totalSold) return -1;
        return 0;
      })
      .slice(0, limit)
      .map(s => ({
        address: s.address,
        totalSold: s.totalSold.toString(),
        artworkCount: s.artworkCount,
      }));

    // Get unique addresses for user lookup
    const allAddresses = Array.from(
      new Set([
        ...topBuyers.map(b => b.address.toLowerCase()),
        ...topSellers.map(s => s.address.toLowerCase()),
      ])
    );

    // Fetch user data from cache
    const users = allAddresses.length > 0
      ? await db.select()
          .from(userCache)
          .where(inArray(userCache.ethAddress, allAddresses))
      : [];

    // Find addresses that aren't in cache and discover them in background
    const cachedAddresses = new Set(users.map(u => u.ethAddress.toLowerCase()));
    const missingAddresses = allAddresses.filter(
      address => !cachedAddresses.has(address)
    );

    if (missingAddresses.length > 0) {
      // Discover missing users in background (non-blocking)
      discoverAndCacheUsers(missingAddresses, { failSilently: true }).catch((error) => {
        console.error("Error discovering missing users:", error);
      });
    }

    // Enrich buyers and sellers with user data
    const enrichedBuyers = topBuyers.map(buyer => {
      const user = users.find(
        u => u.ethAddress.toLowerCase() === buyer.address.toLowerCase()
      );
      return {
        ...buyer,
        username: user?.username || null,
        displayName: user?.displayName || null,
        pfpUrl: user?.pfpUrl || null,
        fid: user?.fid || null,
      };
    });

    const enrichedSellers = topSellers.map(seller => {
      const user = users.find(
        u => u.ethAddress.toLowerCase() === seller.address.toLowerCase()
      );
      return {
        ...seller,
        username: user?.username || null,
        displayName: user?.displayName || null,
        pfpUrl: user?.pfpUrl || null,
        fid: user?.fid || null,
      };
    });

    return NextResponse.json({
      success: true,
      buyers: enrichedBuyers,
      sellers: enrichedSellers,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error("Error fetching top buyers and sellers:", error);

    return NextResponse.json(
      {
        success: false,
        buyers: [],
        sellers: [],
        error: error instanceof Error ? error.message : "Failed to fetch top buyers and sellers",
      },
      { status: 500 }
    );
  }
}
