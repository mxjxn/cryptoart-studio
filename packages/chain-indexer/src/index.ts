/**
 * @cryptoart/chain-indexer
 * 
 * Vercel-based chain event indexer to replace hosted subgraph.
 * Polls contracts for events using viem and stores them in Postgres.
 * 
 * Integrates with collection-indexer for factory-discovered collections.
 * Reuses indexed_contracts table for checkpoint tracking.
 */

export * from './types/events.js';
export * from './schema.js';
export * from './config/contracts.js';
export * from './indexer/client.js';
export * from './indexer/database.js';
export * from './indexer/indexer.js';
export * from './indexer/processors.js';
export * from './indexer/factory-watcher.js';

// Re-export ABI modules for convenience
export { MarketplaceLibABI } from './config/abis/MarketplaceLib.js';
export { SettlementLibABI } from './config/abis/SettlementLib.js';
