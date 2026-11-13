import { sql, type SQL } from 'drizzle-orm';
import { db } from '@cryptoart/db/client';
import { indexedContracts } from '@cryptoart/db';
import type { Address } from 'viem';
import {
  chainEvents,
  listings,
  bids,
  purchases,
  offers,
  escrows,
  type ChainEvent,
} from '../schema.js';

/**
 * Serialize BigInt values as strings for JSONB storage
 * Recursively walks objects and arrays
 */
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  return obj;
}

/**
 * Get or initialize checkpoint for a contract
 * Uses the shared indexed_contracts table
 */
export async function getCheckpoint(
  chainId: number,
  contract: Address,
  contractType: 'marketplace' | 'factory' = 'marketplace'
): Promise<bigint> {
  const normalizedContract = contract.toLowerCase();
  
  const result = await db
    .select()
    .from(indexedContracts)
    .where(
      sql`${indexedContracts.contractAddress} = ${normalizedContract} AND ${indexedContracts.chainId} = ${chainId}`
    )
    .limit(1);

  // If no checkpoint exists, initialize it
  if (!result[0]) {
    return 0n;
  }

  return BigInt(result[0].lastIndexedBlock);
}

/**
 * Update checkpoint for a contract
 * Should be called in the same transaction as inserting events
 */
export async function updateCheckpoint(
  chainId: number,
  contract: Address,
  lastBlock: bigint,
  contractType: 'marketplace' | 'factory' = 'marketplace'
): Promise<void> {
  const normalizedContract = contract.toLowerCase();

  await db
    .insert(indexedContracts)
    .values({
      contractAddress: normalizedContract,
      chainId,
      lastIndexedBlock: Number(lastBlock),
      status: 'active',
      contractType,
      discoveredAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [indexedContracts.contractAddress, indexedContracts.chainId],
      set: {
        lastIndexedBlock: Number(lastBlock),
      },
    });
}

/**
 * Insert chain events (idempotent - unique constraint on chain_id, tx_hash, log_index)
 */
export async function insertChainEvents(events: ChainEvent[]): Promise<number> {
  if (events.length === 0) return 0;

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

  const result = await db
    .insert(chainEvents)
    .values(values)
    .onConflictDoNothing(); // Idempotent insert

  // Return number of rows inserted (drizzle returns array of inserted rows)
  return Array.isArray(result) ? result.length : 0;
}

/**
 * Index events in a transaction: insert events + update checkpoint
 */
export async function indexEventsTransaction(
  chainId: number,
  contract: Address,
  events: ChainEvent[],
  newCheckpoint: bigint,
  contractType: 'marketplace' | 'factory' = 'marketplace'
): Promise<{ eventsInserted: number }> {
  // Use a transaction to ensure atomicity
  return await db.transaction(async (tx) => {
    // Insert events
    let eventsInserted = 0;
    if (events.length > 0) {
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

    // Update checkpoint using indexed_contracts table
    const normalizedContract = contract.toLowerCase();
    await tx
      .insert(indexedContracts)
      .values({
        contractAddress: normalizedContract,
        chainId,
        lastIndexedBlock: Number(newCheckpoint),
        status: 'active',
        contractType,
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
 * Get events by contract and block range
 */
export async function getEventsByBlockRange(
  chainId: number,
  contract: Address,
  fromBlock: bigint,
  toBlock: bigint
): Promise<ChainEvent[]> {
  const normalizedContract = contract.toLowerCase();

  return await db
    .select()
    .from(chainEvents)
    .where(
      sql`${chainEvents.chainId} = ${chainId} 
        AND ${chainEvents.contract} = ${normalizedContract}
        AND ${chainEvents.blockNumber} >= ${fromBlock}
        AND ${chainEvents.blockNumber} <= ${toBlock}`
    )
    .orderBy(chainEvents.blockNumber, chainEvents.logIndex);
}

/**
 * Get latest events across all contracts
 */
export async function getLatestEvents(limit = 100): Promise<ChainEvent[]> {
  return await db
    .select()
    .from(chainEvents)
    .orderBy(sql`${chainEvents.blockNumber} DESC, ${chainEvents.logIndex} DESC`)
    .limit(limit);
}
