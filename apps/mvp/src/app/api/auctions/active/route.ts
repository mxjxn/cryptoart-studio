import { NextRequest, NextResponse } from 'next/server';
import { request, gql } from 'graphql-request';
import { CHAIN_ID } from '~/lib/contracts/marketplace';
import { fetchNFTMetadata } from '~/lib/nft-metadata';
import type { EnrichedAuctionData } from '~/lib/types';
import { Address } from 'viem';

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
      hasBid
      finalized
      createdAt
      createdAtBlock
      updatedAt
      bids(orderBy: amount, orderDirection: desc, first: 1000) {
        id
        bidder
        amount
        timestamp
      }
    }
  }
`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const first = parseInt(searchParams.get('first') || '16'); // Default to 16 for homepage
    const skip = parseInt(searchParams.get('skip') || '0');
    const enrich = searchParams.get('enrich') !== 'false'; // Default to true

    const endpoint = getSubgraphEndpoint();
    
    const data = await request<{ listings: any[] }>(
      endpoint,
      ACTIVE_LISTINGS_QUERY,
      {
        first: Math.min(first, 1000),
        skip,
      }
    );

    let enrichedAuctions: EnrichedAuctionData[] = data.listings;

    if (enrich) {
      // Enrich auctions with metadata and bid information
      enrichedAuctions = await Promise.all(
        data.listings.map(async (listing) => {
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

          return enriched;
        })
      );
    }

    return NextResponse.json({
      success: true,
      auctions: enrichedAuctions,
      count: enrichedAuctions.length,
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

