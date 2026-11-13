/**
 * @cryptoart/chain-indexer
 * 
 * Vercel-based chain event indexer to replace hosted subgraph.
 * Polls contracts for events using viem and stores them in Postgres.
 */

export * from './types/events.js';
export * from './schema.js';
export * from './config/contracts.js';
export * from './indexer/client.js';
export * from './indexer/database.js';
export * from './indexer/indexer.js';
export * from './indexer/processors.js';
