/**
 * Unified Indexer Package
 * Provides unified access to LSSVM pools and Auctionhouse listings
 */

// Export unified query functions
export {
  getSalesForCollection,
  getPoolData,
  getAuctionData,
  getSalesOptions, // deprecated but kept for backward compatibility
} from './unified.js';

// Export types
export type {
  SalesMethod,
  PoolData,
  AuctionData,
  SalesOptions, // deprecated but kept for backward compatibility
  CollectionSales,
} from './types.js';

// Export individual query functions (for advanced use cases)
export {
  queryPoolsByNFTContract,
  queryPoolById,
  queryPoolDetails, // deprecated but kept for backward compatibility
} from './lssvm-queries.js';

export {
  queryListingsByTokenAddress,
  queryListingById,
} from './auctionhouse-queries.js';

// Export config
export {
  CONTRACT_ADDRESSES,
  SUBGRAPH_ENDPOINTS,
  CHAIN_IDS,
} from './config.js';
