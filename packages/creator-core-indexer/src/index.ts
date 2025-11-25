export { CreatorCoreIndexer } from './indexer';
export { getConfig } from './config';
export { createClient, detectCreatorCoreContract } from './contracts';
export * from './events';
export * from './metadata';

// Main entry point - start the indexer when run directly
import { CreatorCoreIndexer } from './indexer.js';

// Start the indexer (this file is always run directly, not imported)
const indexer = new CreatorCoreIndexer();

indexer.initialize().then(() => {
  console.log('Creator Core Indexer initialized, starting...');
  indexer.start();
}).catch((error) => {
  console.error('Failed to initialize Creator Core Indexer:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping indexer...');
  indexer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping indexer...');
  indexer.stop();
  process.exit(0);
});

