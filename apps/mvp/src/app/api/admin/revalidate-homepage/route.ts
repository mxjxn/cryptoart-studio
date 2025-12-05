import { NextRequest, NextResponse } from 'next/server';
import { request, gql } from 'graphql-request';
import { revalidatePath, revalidateTag } from 'next/cache';
import { verifyAdmin } from '~/lib/server/admin';

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

const LATEST_LISTING_QUERY = gql`
  query LatestListing {
    listings(
      first: 1
      orderBy: listingId
      orderDirection: desc
    ) {
      id
      listingId
    }
  }
`;

const RECENT_LISTINGS_QUERY = gql`
  query RecentListings($first: Int!) {
    listings(
      first: $first
      orderBy: listingId
      orderDirection: desc
    ) {
      id
      listingId
      createdAt
    }
  }
`;

/**
 * Get the latest listing ID from subgraph
 */
async function fetchLatestListingId(): Promise<string | null> {
  try {
    const endpoint = getSubgraphEndpoint();
    const data = await request<{ listings: Array<{ id: string }> }>(
      endpoint,
      LATEST_LISTING_QUERY,
      {},
      getSubgraphHeaders()
    );
    
    if (data.listings && data.listings.length > 0) {
      return data.listings[0].id;
    }
    return null;
  } catch (error) {
    console.error('Error fetching latest listing ID:', error);
    return null;
  }
}

/**
 * Get recent listings to check for new auctions
 */
async function fetchRecentListings(count: number = 5): Promise<Array<{ id: string; listingId: string; createdAt: string }>> {
  try {
    const endpoint = getSubgraphEndpoint();
    const data = await request<{ listings: Array<{ id: string; listingId: string; createdAt: string }> }>(
      endpoint,
      RECENT_LISTINGS_QUERY,
      { first: count },
      getSubgraphHeaders()
    );
    
    return data.listings || [];
  } catch (error) {
    console.error('Error fetching recent listings:', error);
    return [];
  }
}

/**
 * POST /api/admin/revalidate-homepage
 * Admin endpoint to manually trigger homepage revalidation and check for new auctions
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    // Get current latest listing ID from subgraph
    const currentListingId = await fetchLatestListingId();
    
    // Get recent listings to show what's new
    const recentListings = await fetchRecentListings(5);
    
    // Revalidate the homepage and auction cache
    revalidatePath('/');
    revalidateTag('auctions');
    
    return NextResponse.json({
      success: true,
      latestListingId: currentListingId,
      recentListings: recentListings.map(l => ({
        listingId: l.listingId,
        createdAt: l.createdAt,
      })),
      revalidated: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Error in revalidate-homepage:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

