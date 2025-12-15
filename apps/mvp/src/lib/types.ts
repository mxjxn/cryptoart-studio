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
  finalized?: boolean; // Boolean flag from subgraph (more reliable than status field)
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
 * Bid data structure
 */
export interface BidData {
  id: string;
  bidder: string;
  amount: string;
  timestamp: string;
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
  finalized?: boolean; // Boolean flag from subgraph (more reliable than status field)
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
  // Thumbnail/preview image URL (optimized for homepage display)
  thumbnailUrl?: string;
  
  // Bid information
  bidCount: number;
  highestBid?: {
    amount: string;
    bidder: string;
    timestamp: string;
  };
  
  // Full bid history (sorted by amount descending)
  bids?: BidData[];
  
  // Full metadata object
  metadata?: NFTMetadata;
  
  // ERC20 token info (populated if erc20 is set and not zero address)
  erc20TokenInfo?: ERC20TokenInfo;
  
  // ERC1155 total supply (for ERC1155 tokens)
  erc1155TotalSupply?: string;
  
  // ERC721 collection total supply (for ERC721 tokens)
  erc721TotalSupply?: number;
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

