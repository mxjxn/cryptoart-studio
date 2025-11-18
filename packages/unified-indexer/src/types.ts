/**
 * Type definitions for unified indexer
 */

export type SalesMethod = "pool" | "auction" | "both";

/**
 * LSSVM Pool data structure
 */
export interface PoolData {
  id: string;
  address: string;
  nft: string;
  bondingCurve: string;
  assetRecipient: string;
  poolType: "ERC721" | "ERC1155";
  delta: string;
  fee: string;
  spotPrice: string;
  nftIdRange?: {
    start: string;
    end: string;
  };
  tokenLiquidity?: string;
  createdAt: string;
  createdAtBlock: string;
}

/**
 * Auctionhouse Listing data structure
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
}

/**
 * Unified sales options combining pools and auctions
 * @deprecated Use CollectionSales instead
 */
export interface SalesOptions {
  collectionAddress: string;
  chainId: number;
  pools: PoolData[];
  auctions: AuctionData[];
  hasPools: boolean;
  hasAuctions: boolean;
  hasAnySales: boolean;
}

/**
 * Collection sales data (pools + auctions)
 * This is for display/browsing purposes only, not for creation options
 */
export interface CollectionSales {
  pools: PoolData[];
  auctions: AuctionData[];
}
