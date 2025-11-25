import { NextRequest, NextResponse } from 'next/server';
import { getAuctionData } from '@cryptoart/unified-indexer';
import { CHAIN_ID } from '~/lib/contracts/marketplace';

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

// Map AuctionData from unified-indexer to API response format
function mapAuctionData(auction: any): ListingResponse {
  return {
    listingId: parseInt(auction.listingId),
    seller: auction.seller,
    finalized: auction.status === 'FINALIZED',
    listingType: mapListingType(auction.listingType),
    initialAmount: auction.initialAmount,
    endTime: auction.endTime,
    tokenId: auction.tokenId || '0',
    tokenAddress: auction.tokenAddress,
    currentBidAmount: auction.currentPrice || undefined,
    // Note: currentBidder would need to come from bids query
    // For now, leaving it undefined
    // Metadata would need to be fetched separately from IPFS/contract
  };
}

// Map listing type string to number
function mapListingType(type: string): number {
  const mapping: Record<string, number> = {
    'INDIVIDUAL_AUCTION': 1,
    'FIXED_PRICE': 2,
    'DYNAMIC_PRICE': 3,
    'OFFERS_ONLY': 4,
  };
  return mapping[type] || 0;
}

// GET /api/listings/[listingId] - Get a specific listing
export async function GET(
  request: NextRequest,
  { params }: { params: { listingId: string } }
) {
  try {
    const listingId = params.listingId;
    
    if (!listingId) {
      return NextResponse.json(
        { error: 'Listing ID is required' },
        { status: 400 }
      );
    }

    const auction = await getAuctionData(listingId, CHAIN_ID);

    if (!auction) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    const listing = mapAuctionData(auction);

    return NextResponse.json({
      listing,
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch listing',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

