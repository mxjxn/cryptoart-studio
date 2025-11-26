import { queryListingById } from '@cryptoart/unified-indexer';
import type { AuctionData } from '@cryptoart/unified-indexer';
import { Address } from 'viem';

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '8453', 10);
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Query active auctions (listings) from subgraph via API
 */
export async function getActiveAuctions(options?: { first?: number; skip?: number }): Promise<AuctionData[]> {
  try {
    const first = options?.first ?? 100;
    const skip = options?.skip ?? 0;
    const response = await fetch(`${API_BASE_URL}/api/auctions/active?first=${first}&skip=${skip}`);
    const data = await response.json();
    return data.auctions || [];
  } catch (error) {
    console.error('Error fetching active auctions:', error);
    return [];
  }
}

/**
 * Query a single auction by listing ID
 */
export async function getAuction(listingId: string): Promise<AuctionData | null> {
  try {
    return await queryListingById(CHAIN_ID, listingId);
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

