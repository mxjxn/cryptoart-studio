import type { NFTMetadata } from './nft-metadata';

/**
 * Base auction data structure from the subgraph
 */
export interface AuctionData {
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
  // ERC20 payment token (zero address means ETH)
  erc20?: string;
}

/**
 * ERC20 token info for display
 */
export interface ERC20TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

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
  // ERC20 payment token (zero address means ETH)
  erc20?: string;
  
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
  
  // ERC20 token info (populated if erc20 is set and not zero address)
  erc20TokenInfo?: ERC20TokenInfo;
}

/**
 * Offer structure from the marketplace contract
 */
export interface Offer {
  offerer: string;
  amount: string;
  timestamp: string;
  accepted: boolean;
}

