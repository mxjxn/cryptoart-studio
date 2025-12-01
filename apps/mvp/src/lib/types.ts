import type { AuctionData } from '@cryptoart/unified-indexer';
import type { NFTMetadata } from './nft-metadata';

/**
 * Enriched auction data with metadata and bid information
 */
export interface EnrichedAuctionData extends AuctionData {
  // Metadata fields
  title?: string;
  artist?: string;
  image?: string;
  description?: string;
  
  // Bid information
  bidCount: number;
  highestBid?: {
    amount: string;
    bidder: string;
    timestamp: string;
  };
  
  // Full metadata object
  metadata?: NFTMetadata;
}

