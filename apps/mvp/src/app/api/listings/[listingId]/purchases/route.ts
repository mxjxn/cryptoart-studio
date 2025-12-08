import { NextRequest, NextResponse } from 'next/server';
import { request, gql } from 'graphql-request';
import { getDatabase, userCache, inArray } from '@cryptoart/db';
import { discoverAndCacheUsers } from '~/lib/server/user-discovery';

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

const PURCHASES_BY_LISTING_QUERY = gql`
  query PurchasesByListing($listingId: BigInt!) {
    purchases(
      where: { listingId: $listingId }
      orderBy: timestamp
      orderDirection: desc
      first: 1000
    ) {
      id
      buyer
      count
      amount
      timestamp
      transactionHash
    }
  }
`;

/**
 * GET /api/listings/[listingId]/purchases
 * Fetch all purchases for a listing, grouped by buyer with totals
 * Returns buyers with their FC handle, avatar, wallet address, and total quantity purchased
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;
    
    if (!listingId) {
      return NextResponse.json(
        { error: 'Listing ID is required' },
        { status: 400 }
      );
    }

    const endpoint = getSubgraphEndpoint();
    const db = getDatabase();

    // Fetch purchases from subgraph
    const purchasesData = await request<{
      purchases: Array<{
        id: string;
        buyer: string;
        count: number;
        amount: string;
        timestamp: string;
        transactionHash: string;
      }>;
    }>(
      endpoint,
      PURCHASES_BY_LISTING_QUERY,
      { listingId },
      getSubgraphHeaders()
    );

    if (!purchasesData.purchases || purchasesData.purchases.length === 0) {
      return NextResponse.json({ buyers: [] }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      });
    }

    // Group purchases by buyer and sum quantities
    const buyerMap = new Map<string, {
      buyer: string;
      totalCount: number;
      firstPurchase: string;
      lastPurchase: string;
    }>();

    for (const purchase of purchasesData.purchases) {
      const buyerLower = purchase.buyer.toLowerCase();
      const existing = buyerMap.get(buyerLower);
      
      if (existing) {
        existing.totalCount += purchase.count;
        // Keep earliest timestamp
        if (parseInt(purchase.timestamp) < parseInt(existing.firstPurchase)) {
          existing.firstPurchase = purchase.timestamp;
        }
        // Keep latest timestamp
        if (parseInt(purchase.timestamp) > parseInt(existing.lastPurchase)) {
          existing.lastPurchase = purchase.timestamp;
        }
      } else {
        buyerMap.set(buyerLower, {
          buyer: purchase.buyer,
          totalCount: purchase.count,
          firstPurchase: purchase.timestamp,
          lastPurchase: purchase.timestamp,
        });
      }
    }

    // Get unique buyer addresses
    const buyerAddresses = Array.from(buyerMap.keys());

    // Fetch user data from cache
    const users = buyerAddresses.length > 0
      ? await db.select()
          .from(userCache)
          .where(inArray(userCache.ethAddress, buyerAddresses))
      : [];

    // Find addresses that aren't in cache and discover them in background
    const cachedAddresses = new Set(users.map(u => u.ethAddress.toLowerCase()));
    const missingAddresses = buyerAddresses.filter(
      address => !cachedAddresses.has(address)
    );
    
    if (missingAddresses.length > 0) {
      // Discover missing users in background (non-blocking)
      discoverAndCacheUsers(missingAddresses, { failSilently: true }).catch((error) => {
        console.error("Error discovering missing buyers:", error);
      });
    }

    // Map buyers to user data and sort by most recent purchase
    const buyers = Array.from(buyerMap.values())
      .map((buyerData) => {
        const user = users.find(
          u => u.ethAddress.toLowerCase() === buyerData.buyer.toLowerCase()
        );
        
        return {
          address: buyerData.buyer,
          totalCount: buyerData.totalCount,
          firstPurchase: buyerData.firstPurchase,
          lastPurchase: buyerData.lastPurchase,
          username: user?.username || null,
          displayName: user?.displayName || null,
          pfpUrl: user?.pfpUrl || null,
          fid: user?.fid || null,
        };
      })
      .sort((a, b) => parseInt(b.lastPurchase) - parseInt(a.lastPurchase));

    return NextResponse.json(
      { buyers },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchases' },
      { status: 500 }
    );
  }
}

