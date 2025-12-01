import type { AuctionData } from '@cryptoart/unified-indexer';
import type { EnrichedAuctionData } from './types';
import { Address } from 'viem';

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '8453', 10);

/**
 * Query active auctions (listings) from subgraph via API
 * Returns enriched auctions with metadata and bid information
 */
export async function getActiveAuctions(options?: { first?: number; skip?: number; enrich?: boolean }): Promise<EnrichedAuctionData[]> {
  try {
    const first = options?.first ?? 16;
    const skip = options?.skip ?? 0;
    const enrich = options?.enrich !== false;
    // Use relative URL for client-side calls
    const response = await fetch(`/api/auctions/active?first=${first}&skip=${skip}&enrich=${enrich}`);
    const data = await response.json();
    return data.auctions || [];
  } catch (error) {
    console.error('Error fetching active auctions:', error);
    return [];
  }
}

/**
 * Query a single auction by listing ID
 * Returns enriched auction with metadata and bid information
 */
export async function getAuction(listingId: string): Promise<EnrichedAuctionData | null> {
  try {
    // Use relative URL for client-side calls
    const response = await fetch(`/api/auctions/${listingId}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch auction: ${response.statusText}`);
    }
    const data = await response.json();
    return data.auction || null;
  } catch (error) {
    console.error('Error fetching auction:', error);
    return null;
  }
}

/**
 * Query auctions by seller address
 */
export async function getAuctionsBySeller(seller: Address, options?: { first?: number; skip?: number }): Promise<AuctionData[]> {
  // TODO: Implement query for auctions by seller
  // This will require a custom GraphQL query
  return [];
}

/**
 * Query auctions where user has placed bids
 */
export async function getAuctionsWithBids(bidder: Address, options?: { first?: number; skip?: number }): Promise<AuctionData[]> {
  // TODO: Implement query for auctions with user's bids
  // This will require querying bids and joining with listings
  return [];
}

