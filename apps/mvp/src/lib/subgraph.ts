import type { AuctionData, EnrichedAuctionData } from './types';
import { Address } from 'viem';

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '8453', 10);

/**
 * Query active auctions (listings) from subgraph via API
 * Returns enriched auctions with metadata and bid information
 * @param options - Query options
 * @param options.cache - Whether to use cached data (default: true for initial load, false for updates)
 */
export async function getActiveAuctions(options?: { 
  first?: number; 
  skip?: number; 
  enrich?: boolean;
  cache?: boolean;
}): Promise<EnrichedAuctionData[]> {
  try {
    const first = options?.first ?? 16;
    const skip = options?.skip ?? 0;
    const enrich = options?.enrich !== false;
    const useCache = options?.cache !== false; // Default to true for cached responses
    // Use relative URL for client-side calls
    const response = await fetch(`/api/auctions/active?first=${first}&skip=${skip}&enrich=${enrich}&cache=${useCache}`);
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
  try {
    const first = options?.first || 100;
    const skip = options?.skip || 0;
    const normalizedSeller = seller.toLowerCase();
    
    console.log(`[getAuctionsBySeller] Fetching auctions for seller: ${normalizedSeller}`);
    
    const response = await fetch(`/api/auctions/by-seller/${normalizedSeller}?first=${first}&skip=${skip}&enrich=true`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[getAuctionsBySeller] API error (${response.status}):`, errorText);
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch auctions by seller: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[getAuctionsBySeller] Received ${data.auctions?.length || 0} auctions for seller ${normalizedSeller}`);
    return data.auctions || [];
  } catch (error) {
    console.error('[getAuctionsBySeller] Error fetching auctions by seller:', error);
    return [];
  }
}

/**
 * Query auctions where user has placed bids
 */
export async function getAuctionsWithBids(bidder: Address, options?: { first?: number; skip?: number }): Promise<AuctionData[]> {
  try {
    const first = options?.first || 100;
    const skip = options?.skip || 0;
    
    const response = await fetch(`/api/auctions/with-bids/${bidder}?first=${first}&skip=${skip}&enrich=true`);
    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch auctions with bids: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.auctions || [];
  } catch (error) {
    console.error('Error fetching auctions with bids:', error);
    return [];
  }
}

/**
 * Query auctions where user has made offers
 */
export async function getAuctionsWithOffers(offerer: Address, options?: { first?: number; skip?: number }): Promise<AuctionData[]> {
  try {
    const first = options?.first || 100;
    const skip = options?.skip || 0;
    
    const response = await fetch(`/api/auctions/with-offers/${offerer}?first=${first}&skip=${skip}&enrich=true`);
    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch auctions with offers: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.auctions || [];
  } catch (error) {
    console.error('Error fetching auctions with offers:', error);
    return [];
  }
}

