import { NextRequest, NextResponse } from 'next/server';
import { request, gql } from 'graphql-request';
import { CHAIN_ID } from '~/lib/contracts/marketplace';
import { fetchNFTMetadata } from '~/lib/nft-metadata';
import type { EnrichedAuctionData } from '~/lib/types';
import { Address } from 'viem';
import { normalizeListingType } from '~/lib/server/auction';
import { discoverAndCacheUserBackground } from '~/lib/server/user-discovery';

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
};

const LISTING_BY_ID_QUERY = gql`
  query ListingById($id: ID!) {
    listing(id: $id) {
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
      hasBid
      finalized
      createdAt
      createdAtBlock
      updatedAt
      erc20
      bids(orderBy: amount, orderDirection: desc, first: 1000) {
        id
        bidder
        amount
        timestamp
      }
    }
  }
`;

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
    
    const data = await request<{ listing: any | null }>(
      endpoint,
      LISTING_BY_ID_QUERY,
      { id: listingId }
    );

    if (!data.listing) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    const listing = data.listing;
    
    // Discover seller and all bidders in background (validate addresses first, wrapped in try-catch to not block response)
    try {
      if (listing.seller && /^0x[a-fA-F0-9]{40}$/i.test(listing.seller)) {
        discoverAndCacheUserBackground(listing.seller);
      }
      if (listing.bids && listing.bids.length > 0) {
        listing.bids.forEach((bid: any) => {
          if (bid.bidder && /^0x[a-fA-F0-9]{40}$/i.test(bid.bidder)) {
            discoverAndCacheUserBackground(bid.bidder);
          }
        });
      }
    } catch (error) {
      // Don't let user discovery errors break the API response
      console.error('[auctions API] Error in background user discovery:', error);
    }
    
    const bidCount = listing.bids?.length || 0;
    const highestBid = listing.bids && listing.bids.length > 0 
      ? listing.bids[0] // Already sorted by amount desc
      : undefined;

    // Fetch NFT metadata
    let metadata = null;
    if (listing.tokenAddress && listing.tokenId) {
      try {
        metadata = await fetchNFTMetadata(
          listing.tokenAddress as Address,
          listing.tokenId,
          listing.tokenSpec
        );
      } catch (error) {
        console.error(`Error fetching metadata for ${listing.tokenAddress}:${listing.tokenId}:`, error);
      }
    }

    const enriched: EnrichedAuctionData = {
      ...listing,
      listingType: normalizeListingType(listing.listingType, listing),
      bidCount,
      highestBid: highestBid ? {
        amount: highestBid.amount,
        bidder: highestBid.bidder,
        timestamp: highestBid.timestamp,
      } : undefined,
      title: metadata?.title || metadata?.name,
      artist: metadata?.artist || metadata?.creator,
      image: metadata?.image,
      description: metadata?.description,
      metadata,
    };

    return NextResponse.json({
      success: true,
      auction: enriched,
    });
  } catch (error) {
    console.error('Error fetching auction:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch auction',
      },
      { status: 500 }
    );
  }
}

