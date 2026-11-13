import type { Address } from 'viem';
import { parseAbiItem, decodeEventLog } from 'viem';
import { getPublicClient } from './client.js';
import { getCheckpoint, indexEventsTransaction } from './database.js';
import { db } from '@cryptoart/db/client';
import { indexedContracts } from '@cryptoart/db';
import { sql } from 'drizzle-orm';
import type { ContractConfig, ChainEvent } from '../types/events.js';

/**
 * Factory watcher discovers new collections from factory contracts
 * and automatically adds them to the indexing loop
 */

/**
 * Watch a factory contract for new collection deployments
 * Returns array of newly discovered collection addresses
 */
export async function watchFactory(
  factoryAddress: Address,
  chainId: number,
  factoryAbi: unknown[],
  startBlock: bigint,
  options?: {
    maxBlockRange?: number;
  }
): Promise<Address[]> {
  if (startBlock === 0n) {
    throw new Error(`[FactoryWatcher] Factory on chain ${chainId} requires a valid start block, not 0`);
  }

  const client = getPublicClient(chainId);
  const maxRange = options?.maxBlockRange ?? 2000;

  // Get factory checkpoint
  const checkpoint = await getCheckpoint(chainId, factoryAddress, 'factory');
  const fromBlock = checkpoint > 0n ? checkpoint + 1n : startBlock;

  // Get current head (with safety margin)
  const latestBlock = await client.getBlockNumber();
  const safeHead = latestBlock - 3n;
  
  if (fromBlock > safeHead) {
    return []; // Already caught up
  }

  const toBlock = safeHead;
  const discovered: Address[] = [];

  // Fetch CollectionCreated events in chunks
  let currentBlock = fromBlock;
  while (currentBlock <= toBlock) {
    const chunkEnd = currentBlock + BigInt(maxRange) - 1n;
    const endBlock = chunkEnd < toBlock ? chunkEnd : toBlock;

    try {
      // Look for CollectionCreated events with full signature: (address, address, string, string)
      const collectionCreatedEvent = parseAbiItem(
        'event CollectionCreated(address indexed collection, address indexed owner, string name, string symbol)'
      );

      const logs = await client.getLogs({
        address: factoryAddress,
        event: collectionCreatedEvent,
        fromBlock: currentBlock,
        toBlock: endBlock,
      });

      const chunkEvents: ChainEvent[] = [];

      // Process each discovered collection
      for (const log of logs) {
        const decoded = decodeEventLog({
          abi: [collectionCreatedEvent],
          data: log.data,
          topics: log.topics,
        });

        const collectionAddress = (decoded.args as any).collection as Address;
        const ownerAddress = (decoded.args as any).owner as Address;
        const name = (decoded.args as any).name as string;
        const symbol = (decoded.args as any).symbol as string;

        // Store raw event
        chunkEvents.push({
          chainId,
          contract: factoryAddress,
          eventName: 'CollectionCreated',
          blockNumber: log.blockNumber,
          blockHash: log.blockHash!,
          transactionHash: log.transactionHash!,
          logIndex: Number(log.logIndex),
          args: {
            collection: collectionAddress,
            owner: ownerAddress,
            name,
            symbol,
          },
        });

        // Add to discovered list
        discovered.push(collectionAddress);

        // Register collection in indexed_contracts so it will be picked up by marketplace indexer
        await db
          .insert(indexedContracts)
          .values({
            contractAddress: collectionAddress.toLowerCase(),
            chainId,
            lastIndexedBlock: Number(log.blockNumber), // Start from creation block
            status: 'active',
            contractType: 'such_collection',
            discoveredAt: new Date(),
          })
          .onConflictDoNothing();

        console.log(
          `[FactoryWatcher] Discovered collection ${name} (${collectionAddress}) on chain ${chainId} at block ${log.blockNumber}`
        );
      }

      // Save checkpoint incrementally per chunk
      await indexEventsTransaction(chainId, factoryAddress, chunkEvents, endBlock, 'factory');

      currentBlock = endBlock + 1n;
    } catch (error) {
      console.error(
        `[FactoryWatcher] Error fetching blocks ${currentBlock}-${endBlock}:`,
        error
      );
      throw error;
    }
  }

  return discovered;
}

/**
 * Get all factory-discovered collections that need marketplace event indexing
 */
export async function getDiscoveredCollections(chainId: number): Promise<
  Array<{
    address: Address;
    lastIndexedBlock: bigint;
  }>
> {
  const results = await db
    .select({
      address: indexedContracts.contractAddress,
      lastIndexedBlock: indexedContracts.lastIndexedBlock,
    })
    .from(indexedContracts)
    .where(
      sql`${indexedContracts.chainId} = ${chainId} 
        AND ${indexedContracts.contractType} = 'such_collection'
        AND ${indexedContracts.status} = 'active'`
    );

  return results.map((r) => ({
    address: r.address as Address,
    lastIndexedBlock: BigInt(r.lastIndexedBlock),
  }));
}

/**
 * Factory configurations (from collection-indexer pattern)
 */
export const FACTORY_CONFIGS = [
  {
    chainId: 8453, // Base
    address: '0x...' as Address, // TODO: Get from env or collection-indexer config
    startBlock: 0n, // TODO: Get from env or collection-indexer config
    label: 'ERC721 Factory (Base)',
  },
  {
    chainId: 8453, // Base
    address: '0x...' as Address, // TODO: Get 1155 factory from env
    startBlock: 0n,
    label: 'ERC1155 Factory (Base)',
  },
];
