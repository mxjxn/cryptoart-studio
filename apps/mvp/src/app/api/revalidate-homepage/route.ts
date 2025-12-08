import { NextRequest, NextResponse } from 'next/server';
import { request, gql } from 'graphql-request';
import { revalidatePath } from 'next/cache';

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
 * Cron job endpoint to check if homepage needs revalidation
 * Runs every 15 minutes and revalidates if latest listing ID has changed
 * 
 * Note: In serverless environments, we can't reliably store state between invocations.
 * For production, consider using Vercel KV, Redis, or a database to track the last listing ID.
 * For now, we'll revalidate every time the cron runs (which is acceptable since it's only every 15 minutes).
 */
export async function GET(req: NextRequest) {
  try {
    // Verify this is a cron job request (optional but recommended)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current latest listing ID from subgraph
    const currentListingId = await fetchLatestListingId();
    
    if (!currentListingId) {
      return NextResponse.json({
        success: false,
        message: 'Could not fetch latest listing ID',
        timestamp: new Date().toISOString(),
      });
    }

    // In a serverless environment, we can't reliably store state between invocations.
    // For a proper implementation, you'd:
    // 1. Store the last listing ID in Vercel KV, Redis, or a database
    // 2. Compare currentListingId with stored ID
    // 3. Only revalidate if they differ
    
    // For now, we'll revalidate every time (acceptable since cron runs every 15 minutes)
    // This ensures the homepage is always fresh when new listings are created
    
    // Revalidate the homepage and auction cache
    revalidatePath('/');
    revalidatePath('/api/listings/browse');
    
    return NextResponse.json({
      success: true,
      latestListingId: currentListingId,
      revalidated: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in revalidate-homepage cron:', error);
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

