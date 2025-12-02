import type { AuctionData } from '@cryptoart/unified-indexer';
import type { NFTMetadata } from './nft-metadata';

/**
 * Enriched auction data with metadata and bid information
 */
export interface EnrichedAuctionData extends AuctionData {
  // Explicitly include base properties for TypeScript compatibility
  // This ensures TypeScript recognizes these properties in all build environments (including Vercel)
  id: string;
  listingId: string;
  marketplace: string;
  seller: string;
  tokenAddress: string;
  tokenId?: string;
  tokenSpec: "ERC721" | "ERC1155";
  listingType: "INDIVIDUAL_AUCTION" | "FIXED_PRICE" | "DYNAMIC_PRICE" | "OFFERS_ONLY";
  initialAmount: string;
  totalAvailable: string;
  totalPerSale: string;
  startTime: string;
  endTime: string;
  lazy: boolean;
  status: "ACTIVE" | "FINALIZED" | "CANCELLED";
  totalSold: string;
  currentPrice?: string;
  createdAt: string;
  createdAtBlock: string;
  
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

