import { NextRequest, NextResponse } from 'next/server';
import { request, gql } from 'graphql-request';
import { CHAIN_ID } from '~/lib/contracts/marketplace';

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
};

const ACTIVE_LISTINGS_QUERY = gql`
  query ActiveListings($first: Int!, $skip: Int!) {
    listings(
      where: { status: "ACTIVE", finalized: false }
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
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
      currentPrice
      createdAt
      createdAtBlock
      finalizedAt
      bids(orderBy: timestamp, orderDirection: desc, first: 1) {
        bidder
        amount
      }
    }
  }
`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const first = parseInt(searchParams.get('first') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');

    const endpoint = getSubgraphEndpoint();
    
    const data = await request<{ listings: any[] }>(
      endpoint,
      ACTIVE_LISTINGS_QUERY,
      {
        first: Math.min(first, 1000),
        skip,
      }
    );

    return NextResponse.json({
      success: true,
      auctions: data.listings,
      count: data.listings.length,
    });
  } catch (error) {
    console.error('Error fetching active auctions:', error);
    
    return NextResponse.json(
      {
        success: true,
        auctions: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Failed to fetch active auctions',
      },
      { status: 200 }
    );
  }
}

