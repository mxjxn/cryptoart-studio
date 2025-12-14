import { NextResponse } from 'next/server';
import { request, gql } from 'graphql-request';
import { normalizeListingType, normalizeTokenSpec } from '~/lib/server/auction';

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured');
};

const getSubgraphHeaders = (): Record<string, string> => {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY || process.env.NEXT_PUBLIC_GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}` };
  }
  return {};
};

const ALL_LISTINGS_QUERY = gql`
  query AllListings($first: Int!, $skip: Int!) {
    listings(
      first: $first
      skip: $skip
      orderBy: listingId
      orderDirection: asc
    ) {
      id
      listingId
      seller
      tokenAddress
      tokenId
      tokenSpec
      listingType
      startTime
      endTime
      status
      finalized
      totalAvailable
      totalSold
      initialAmount
      createdAt
      createdAtBlock
      lazy
      erc20
    }
  }
`;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    
    const endpoint = getSubgraphEndpoint();
    const headers = getSubgraphHeaders();
    const allListings: any[] = [];
    let skip = 0;
    const pageSize = 100;

    // Fetch all listings in pages
    while (allListings.length < limit) {
      const remaining = limit - allListings.length;
      const currentPageSize = Math.min(pageSize, remaining);

      const data = await request<{ listings: any[] }>(
        endpoint,
        ALL_LISTINGS_QUERY,
        {
          first: currentPageSize,
          skip,
        },
        headers
      );

      if (!data.listings || data.listings.length === 0) {
        break;
      }

      allListings.push(...data.listings);
      skip += currentPageSize;

      if (data.listings.length < currentPageSize) {
        break;
      }
    }

    // Normalize and format listings
    const formattedListings = allListings.map((listing) => ({
      ...listing,
      listingType: normalizeListingType(listing.listingType, listing),
      tokenSpec: normalizeTokenSpec(listing.tokenSpec),
    }));

    return NextResponse.json({
      success: true,
      listings: formattedListings,
      count: formattedListings.length,
    });
  } catch (error: any) {
    console.error('[Admin Listings] Error fetching listings:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch listings',
      },
      { status: 500 }
    );
  }
}
