import type { Address, Hex, Log } from 'viem';
import { parseAbiItem, decodeEventLog } from 'viem';
import { getPublicClient, getSafeBlockNumber } from './client';
import { getCheckpoint, indexEventsTransaction } from './database';
import type { ContractConfig, ChainEvent, IndexingResult } from '../types/events';
import {
  processCreateListing,
  processCreateListingTokenDetails,
  processCreateListingFees,
  processBidEvent,
  processPurchaseEvent,
  processOfferEvent,
  processModifyListing,
  processCancelListing,
  processFinalizeListing,
  processEscrowEvent,
} from './processors';

/**
 * Maximum block range to fetch in a single getLogs call
 * Adjust based on RPC provider limits
 */
const MAX_BLOCK_RANGE = 2000;

/**
 * Maximum number of retries for failed RPC calls
 */
const MAX_RETRIES = 3;

/**
 * Index events for a single contract
 * Fetches events in chunks and stores them with checkpoint updates
 */
export async function indexContract(
  config: ContractConfig,
  options?: {
    fromBlock?: bigint;
    toBlock?: bigint;
    maxBlockRange?: number;
  }
): Promise<IndexingResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    const client = getPublicClient(config.chainId);

    // Get checkpoint (last indexed block)
    const checkpoint = await getCheckpoint(config.chainId, config.address);
    const fromBlock = options?.fromBlock ?? (checkpoint > 0n ? checkpoint + 1n : config.startBlock);

    // Get safe head block (staying behind chain head to avoid reorgs)
    const safeHead = await getSafeBlockNumber(config.chainId);
    const toBlock = options?.toBlock ? 
      (options.toBlock < safeHead ? options.toBlock : safeHead) : 
      safeHead;

    // If we're already caught up, return early
    if (fromBlock > toBlock) {
      return {
        contract: config.address,
        chainId: config.chainId,
        startBlock: fromBlock,
        endBlock: toBlock,
        eventsIndexed: 0,
        timeTaken: Date.now() - startTime,
      };
    }

    const maxRange = options?.maxBlockRange ?? MAX_BLOCK_RANGE;
    let currentBlock = fromBlock;
    let totalEventsIndexed = 0;

    // Process in chunks
    while (currentBlock <= toBlock) {
      const chunkEnd = currentBlock + BigInt(maxRange) - 1n;
      const endBlock = chunkEnd < toBlock ? chunkEnd : toBlock;

      try {
        // Fetch logs for this chunk
        const logs = await fetchLogsWithRetry(
          client,
          config,
          currentBlock,
          endBlock
        );

        // Parse events
        const events = logs.map((log) => parseLogToEvent(config, log));

        // Fetch block timestamps for events
        const blockTimestamps = new Map<bigint, bigint>();
        for (const event of events) {
          if (!blockTimestamps.has(event.blockNumber)) {
            try {
              const block = await client.getBlock({ blockNumber: event.blockNumber });
              blockTimestamps.set(event.blockNumber, block.timestamp);
            } catch (error) {
              console.error(`[Indexer] Failed to fetch block ${event.blockNumber}:`, error);
              blockTimestamps.set(event.blockNumber, BigInt(Math.floor(Date.now() / 1000)));
            }
          }
        }

        // Process events into domain tables and store with checkpoint in single transaction
        const result = await processAndStoreEvents(
          config.chainId,
          config.address,
          events,
          endBlock,
          blockTimestamps
        );

        totalEventsIndexed += result.eventsInserted;

        console.log(
          `[Indexer] ${config.label || config.address} | Blocks ${currentBlock}-${endBlock} | ${events.length} events | ${result.eventsInserted} new`
        );
      } catch (error) {
        const errorMsg = `Failed to index blocks ${currentBlock}-${endBlock}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Indexer] ${errorMsg}`);
        errors.push(errorMsg);
        
        // Don't continue if a chunk fails - we need sequential processing
        throw new Error(errorMsg);
      }

      currentBlock = endBlock + 1n;
    }

    return {
      contract: config.address,
      chainId: config.chainId,
      startBlock: fromBlock,
      endBlock: toBlock,
      eventsIndexed: totalEventsIndexed,
      timeTaken: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(errorMsg);
    
    return {
      contract: config.address,
      chainId: config.chainId,
      startBlock: 0n,
      endBlock: 0n,
      eventsIndexed: 0,
      timeTaken: Date.now() - startTime,
      errors,
    };
  }
}

/**
 * Fetch logs with retry logic
 */
async function fetchLogsWithRetry(
  client: ReturnType<typeof getPublicClient>,
  config: ContractConfig,
  fromBlock: bigint,
  toBlock: bigint,
  attempt = 1
): Promise<Log[]> {
  try {
    // Build event signatures from config
    const eventSignatures = config.events.map((eventName) => {
      // Find the event in the ABI
      const abiEvent = (config.abi as any[]).find(
        (item) => item.type === 'event' && item.name === eventName
      );
      if (!abiEvent) {
        throw new Error(`Event ${eventName} not found in ABI`);
      }
      return parseAbiItem(`event ${eventName}(${abiEvent.inputs.map((i: any) => `${i.indexed ? 'indexed ' : ''}${i.type} ${i.name}`).join(', ')})`);
    });

    const logs = await client.getLogs({
      address: config.address,
      events: eventSignatures,
      fromBlock,
      toBlock,
    });

    return logs;
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      throw error;
    }

    // Exponential backoff
    const delay = Math.pow(2, attempt) * 1000;
    console.warn(
      `[Indexer] getLogs failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`,
      error instanceof Error ? error.message : String(error)
    );
    
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchLogsWithRetry(client, config, fromBlock, toBlock, attempt + 1);
  }
}

/**
 * Parse a raw log into a ChainEvent
 */
function parseLogToEvent(config: ContractConfig, log: Log): ChainEvent {
  // Decode the event
  const decoded = decodeEventLog({
    abi: config.abi,
    data: log.data,
    topics: log.topics,
  });

  return {
    chainId: config.chainId,
    contract: config.address,
    eventName: String(decoded.eventName || 'Unknown'),
    blockNumber: log.blockNumber!,
    blockHash: (log.blockHash || '0x') as `0x${string}`,
    transactionHash: (log.transactionHash || '0x') as `0x${string}`,
    logIndex: Number(log.logIndex),
    args: (decoded.args || {}) as Record<string, unknown>,
    indexedAt: new Date(),
  };
}

/**
 * Process events and store in a single transaction with checkpoint
 * This ensures atomicity and idempotency
 */
async function processAndStoreEvents(
  chainId: number,
  contract: Address,
  events: ChainEvent[],
  newCheckpoint: bigint,
  blockTimestamps: Map<bigint, bigint>
): Promise<{ eventsInserted: number }> {
  const { db: dbInstance } = await import('@cryptoart/db/client');
  const { indexedContracts } = await import('@cryptoart/db');
  
  return await dbInstance.transaction(async (tx) => {
    // Insert raw events
    let eventsInserted = 0;
    if (events.length > 0) {
      const { chainEvents } = await import('../schema');
      const { serializeBigInt } = await import('./database');
      
      const values = events.map((event) => ({
        chainId: event.chainId,
        contract: event.contract.toLowerCase(),
        eventName: event.eventName,
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        args: serializeBigInt(event.args),
        indexedAt: new Date(),
      }));

      const result = await tx
        .insert(chainEvents)
        .values(values)
        .onConflictDoNothing();

      eventsInserted = Array.isArray(result) ? result.length : 0;
    }

    // Process domain events within the same transaction
    for (const event of events) {
      const timestamp = blockTimestamps.get(event.blockNumber) || BigInt(Math.floor(Date.now() / 1000));

      try {
        const marketplace = event.contract;
        switch (event.eventName) {
          case 'CreateListing':
            await processCreateListing(tx, chainId, event.args as any, event.blockNumber, timestamp, marketplace);
            break;
          case 'CreateListingTokenDetails':
            await processCreateListingTokenDetails(tx, chainId, event.args as any, event.blockNumber, timestamp, marketplace);
            break;
          case 'CreateListingFees':
            await processCreateListingFees(tx, chainId, event.args as any, event.blockNumber, timestamp, marketplace);
            break;
          case 'BidEvent':
            await processBidEvent(tx, chainId, event.args as any, event.blockNumber, timestamp, event.transactionHash, event.logIndex, marketplace);
            break;
          case 'PurchaseEvent':
            await processPurchaseEvent(tx, chainId, event.args as any, event.blockNumber, timestamp, event.transactionHash, event.logIndex, marketplace);
            break;
          case 'OfferEvent':
            await processOfferEvent(tx, chainId, event.args as any, event.blockNumber, timestamp, event.transactionHash, event.logIndex);
            break;
          case 'ModifyListing':
            await processModifyListing(tx, chainId, event.args as any, event.blockNumber, timestamp, marketplace);
            break;
          case 'CancelListing':
            await processCancelListing(tx, chainId, event.args as any, event.blockNumber, timestamp, marketplace);
            break;
          case 'FinalizeListing':
            await processFinalizeListing(tx, chainId, event.args as any, event.blockNumber, timestamp, marketplace);
            break;
          case 'Escrow':
            await processEscrowEvent(tx, chainId, event.args as any, event.blockNumber, timestamp, event.transactionHash, event.logIndex);
            break;
        }
      } catch (error) {
        console.error(`[Indexer] Error processing event ${event.eventName} at ${event.transactionHash}:${event.logIndex}:`, error);
        throw error; // Rollback transaction on processing error
      }
    }

    // Update checkpoint
    const normalizedContract = contract.toLowerCase();
    await tx
      .insert(indexedContracts)
      .values({
        contractAddress: normalizedContract,
        chainId,
        lastIndexedBlock: Number(newCheckpoint),
        status: 'active',
        contractType: 'marketplace',
        discoveredAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [indexedContracts.contractAddress, indexedContracts.chainId],
        set: {
          lastIndexedBlock: Number(newCheckpoint),
        },
      });

    return { eventsInserted };
  });
}

/**
 * Backfill events from contract deploy block to current checkpoint
 * Useful for initializing the indexer or catching up after downtime
 */
export async function backfillContract(
  config: ContractConfig,
  options?: {
    maxBlockRange?: number;
  }
): Promise<IndexingResult> {
  console.log(`[Indexer] Starting backfill for ${config.label || config.address}`);
  
  return await indexContract(config, {
    fromBlock: config.startBlock,
    maxBlockRange: options?.maxBlockRange,
  });
}

/**
 * Index all configured contracts
 */
export async function indexAllContracts(
  configs: ContractConfig[],
  options?: {
    maxBlockRange?: number;
    parallel?: boolean;
  }
): Promise<IndexingResult[]> {
  if (options?.parallel) {
    // Index contracts in parallel
    return await Promise.all(
      configs.map((config) => indexContract(config, options))
    );
  } else {
    // Index contracts sequentially
    const results: IndexingResult[] = [];
    for (const config of configs) {
      const result = await indexContract(config, options);
      results.push(result);
    }
    return results;
  }
}
