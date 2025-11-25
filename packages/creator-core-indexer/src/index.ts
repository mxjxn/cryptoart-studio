export { CreatorCoreIndexer } from './indexer.js';
export { getConfig } from './config.js';
export { createClient, detectCreatorCoreContract } from './contracts.js';
export * from './events.js';
export * from './metadata.js';

// Main entry point - start the indexer when run directly
import { CreatorCoreIndexer } from './indexer.js';
import { fileURLToPath } from 'url';
import { resolve as resolvePath } from 'path';

// Check if this file is being run directly (not imported)
const isMainModule = (() => {
  if (typeof process === 'undefined' || !process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  const executedFile = resolvePath(process.argv[1]);
  return currentFile === executedFile || currentFile.replace(/\.ts$/, '.js') === executedFile;
})();

if (isMainModule) {
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
}

