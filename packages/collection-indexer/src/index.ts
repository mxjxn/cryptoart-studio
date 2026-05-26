import { getConfig } from './config.js';
import { createClients } from './client.js';
import { FactoryWatcher } from './factory-watcher.js';
import { CollectionScanner } from './collection-scanner.js';
import { MetadataResolver } from './metadata.js';

const config = getConfig();
console.log(`[Indexer] configuring ${config.chains.length} chain(s): ${config.chains.map((c) => c.chainId).join(', ')}`);

const clients = createClients(config.chains);

const factoryWatchers: FactoryWatcher[] = [];
const collectionScanners: CollectionScanner[] = [];

for (const chainConfig of config.chains) {
  const client = clients.get(chainConfig.chainId);
  if (!client) {
    throw new Error(`No client for chain ${chainConfig.chainId}`);
  }

  const factoryWatcher = new FactoryWatcher(client, chainConfig, config);
  const collectionScanner = new CollectionScanner(client, chainConfig, config);

  factoryWatchers.push(factoryWatcher);
  collectionScanners.push(collectionScanner);
}

const metadataResolver = new MetadataResolver(config);

async function shutdown(): Promise<void> {
  console.log('[Indexer] shutting down...');

  for (const fw of factoryWatchers) fw.stop();
  for (const cs of collectionScanners) cs.stop();
  metadataResolver.stop();

  console.log('[Indexer] all loops stopped');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main(): Promise<void> {
  console.log('[Indexer] initializing...');

  for (const fw of factoryWatchers) {
    await fw.initialize();
  }

  console.log('[Indexer] starting loops...');

  const loopPromises = [
    ...factoryWatchers.map((fw) => fw.start()),
    ...collectionScanners.map((cs) => cs.start()),
    metadataResolver.start(),
  ];

  await Promise.all(loopPromises);
}

main().catch((error) => {
  console.error('[Indexer] fatal error:', error);
  process.exit(1);
});
