import { sql, type SQL } from 'drizzle-orm';
import { db } from '@cryptoart/db/client';
import type { Address } from 'viem';
import {
  indexerCheckpoints,
  chainEvents,
  listings,
  bids,
  purchases,
  offers,
  escrows,
  type ChainEvent,
} from '../schema.js';

/**
 * Get or initialize checkpoint for a contract
 */
export async function getCheckpoint(
  chainId: number,
  contract: Address
): Promise<bigint> {
  const normalizedContract = contract.toLowerCase();
  
  const result = await db
    .select()
    .from(indexerCheckpoints)
    .where(
      sql`${indexerCheckpoints.chainId} = ${chainId} AND ${indexerCheckpoints.contract} = ${normalizedContract}`
    )
    .limit(1);

  return result[0]?.lastBlock ?? 0n;
}

/**
 * Update checkpoint for a contract
 * Should be called in the same transaction as inserting events
 */
export async function updateCheckpoint(
  chainId: number,
  contract: Address,
  lastBlock: bigint
): Promise<void> {
  const normalizedContract = contract.toLowerCase();

  await db
    .insert(indexerCheckpoints)
    .values({
      chainId,
      contract: normalizedContract,
      lastBlock,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [indexerCheckpoints.chainId, indexerCheckpoints.contract],
      set: {
        lastBlock,
        updatedAt: new Date(),
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
    args: event.args,
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
  newCheckpoint: bigint
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
        args: event.args,
        indexedAt: new Date(),
      }));

      const result = await tx
        .insert(chainEvents)
        .values(values)
        .onConflictDoNothing();

      eventsInserted = Array.isArray(result) ? result.length : 0;
    }

    // Update checkpoint
    const normalizedContract = contract.toLowerCase();
    await tx
      .insert(indexerCheckpoints)
      .values({
        chainId,
        contract: normalizedContract,
        lastBlock: newCheckpoint,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [indexerCheckpoints.chainId, indexerCheckpoints.contract],
        set: {
          lastBlock: newCheckpoint,
          updatedAt: new Date(),
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
