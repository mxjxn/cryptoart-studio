import { NextRequest, NextResponse } from 'next/server';
import { request, gql } from 'graphql-request';
import { CHAIN_ID } from '~/lib/contracts/marketplace';

// Get subgraph endpoint from environment or use default
// TODO: Update this with your actual deployed subgraph endpoint
const getSubgraphEndpoint = (): string => {
  // Check for environment variable first
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  
  // Default to The Graph Studio endpoint format
  // Replace with your actual subgraph name/version
  // Example: https://api.studio.thegraph.com/query/5440/cryptoart-auctionhouse/0.0.1
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
};

// GraphQL query to get all active listings
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
      finalized
      bids(orderBy: timestamp, orderDirection: desc, first: 1) {
        bidder
        amount
      }
    }
  }
`;

interface SubgraphListing {
  id: string;
  listingId: string;
  marketplace: string;
  seller: string;
  tokenAddress: string;
  tokenId: string | null;
  tokenSpec: number;
  listingType: number;
  initialAmount: string;
  totalAvailable: string;
  totalPerSale: string;
  startTime: string;
  endTime: string;
  lazy: boolean;
  status: string;
  totalSold: string;
  finalized: boolean;
  bids: Array<{
    bidder: string;
    amount: string;
  }>;
}

interface ListingResponse {
  listingId: number;
  seller: string;
  finalized: boolean;
  listingType: number;
  initialAmount: string;
  endTime: string;
  tokenId: string;
  tokenAddress: string;
  currentBidAmount?: string;
  currentBidder?: string;
  metadata?: {
    name?: string;
    image?: string;
    description?: string;
  };
}

// Map subgraph listing to API response format
function mapListing(listing: SubgraphListing): ListingResponse {
  const latestBid = listing.bids && listing.bids.length > 0 ? listing.bids[0] : null;
  
  return {
    listingId: parseInt(listing.listingId),
    seller: listing.seller,
    finalized: listing.finalized,
    listingType: listing.listingType,
    initialAmount: listing.initialAmount,
    endTime: listing.endTime,
    tokenId: listing.tokenId || '0',
    tokenAddress: listing.tokenAddress,
    currentBidAmount: latestBid ? latestBid.amount : undefined,
    currentBidder: latestBid ? latestBid.bidder : undefined,
    // Metadata would need to be fetched separately from IPFS/contract
    // For now, leaving it undefined
  };
}

// GET /api/listings/active - Get all active listings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const first = parseInt(searchParams.get('first') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');

    const endpoint = getSubgraphEndpoint();
    
    const data = await request<{ listings: SubgraphListing[] }>(
      endpoint,
      ACTIVE_LISTINGS_QUERY,
      {
        first: Math.min(first, 1000), // Cap at 1000
        skip,
      }
    );

    const listings = data.listings.map(mapListing);

    return NextResponse.json({
      listings,
      count: listings.length,
    });
  } catch (error) {
    console.error('Error fetching active listings:', error);
    
    // Return empty array on error instead of failing completely
    // This allows the frontend to still render even if subgraph is not configured
    return NextResponse.json(
      {
        listings: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Failed to fetch active listings',
      },
      { status: 200 } // Return 200 with empty array so frontend doesn't show error
    );
  }
}

