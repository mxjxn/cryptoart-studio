/**
 * @cryptoart/chain-indexer
 * 
 * Vercel-based chain event indexer to replace hosted subgraph.
 * Polls contracts for events using viem and stores them in Postgres.
 * 
 * Integrates with collection-indexer for factory-discovered collections.
 * Reuses indexed_contracts table for checkpoint tracking.
 */

export * from './types/events';
export { 
  chainEvents, 
  listings, 
  bids, 
  purchases, 
  offers, 
  escrows,
  type Listing,
  type Bid,
  type Purchase,
  type Offer,
  type Escrow 
} from './schema';
export * from './config/contracts';
export * from './indexer/client';
export * from './indexer/database';
export * from './indexer/indexer';
export * from './indexer/processors';
export * from './indexer/factory-watcher';

// Re-export ABI modules for convenience
export { MarketplaceLibABI } from './config/abis/MarketplaceLib';
export { SettlementLibABI } from './config/abis/SettlementLib';
