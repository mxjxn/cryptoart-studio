import type { PublicClient } from 'viem';
import { decodeEventLog, type Log } from 'viem';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getDatabase } from '@cryptoart/db';
import { FACTORY_EVENTS, COLLECTION_READ_ABI } from './abis.js';
import type { IndexerConfig, ChainConfig } from './config.js';
import {
  loadFactoryCursor,
  upsertIndexedContract,
} from './state.js';
import { processCollectionCreated } from './processors.js';

export class FactoryWatcher {
  private db: PostgresJsDatabase<Record<string, never>>;
  private client: PublicClient;
  private chainConfig: ChainConfig;
  private config: IndexerConfig;
  private isRunning = false;

  constructor(
    client: PublicClient,
    chainConfig: ChainConfig,
    config: IndexerConfig,
  ) {
    this.db = getDatabase();
    this.client = client;
    this.chainConfig = chainConfig;
    this.config = config;
  }

  async initialize(): Promise<void> {
    const existing = await loadFactoryCursor(
      this.db,
      this.chainConfig.factoryAddress,
      this.chainConfig.chainId,
    );
    if (!existing) {
      await upsertIndexedContract(this.db, {
        contractAddress: this.chainConfig.factoryAddress,
        chainId: this.chainConfig.chainId,
        lastIndexedBlock: this.chainConfig.startBlock,
        contractType: 'factory',
      });
      console.log(
        `[FactoryWatcher] chain=${this.chainConfig.chainId} seeded cursor at block ${this.chainConfig.startBlock}`,
      );
    } else {
      console.log(
        `[FactoryWatcher] chain=${this.chainConfig.chainId} resumed at block ${existing.lastIndexedBlock}`,
      );
    }
  }

  async poll(): Promise<void> {
    const cursor = await loadFactoryCursor(
      this.db,
      this.chainConfig.factoryAddress,
      this.chainConfig.chainId,
    );
    if (!cursor) return;

    const head = await this.client.getBlockNumber();
    const fromBlock = BigInt(cursor.lastIndexedBlock) + 1n;
    const toBlock = head > fromBlock + BigInt(this.config.batchSize)
      ? fromBlock + BigInt(this.config.batchSize)
      : head;

    if (fromBlock > toBlock) return;

    try {
      const logs = await this.client.getLogs({
        address: this.chainConfig.factoryAddress,
        fromBlock,
        toBlock,
        events: FACTORY_EVENTS,
      });

      for (const log of logs) {
        await this.processLog(log);
      }

      await upsertIndexedContract(this.db, {
        contractAddress: this.chainConfig.factoryAddress,
        chainId: this.chainConfig.chainId,
        lastIndexedBlock: Number(toBlock),
        contractType: 'factory',
      });

      if (logs.length > 0) {
        console.log(
          `[FactoryWatcher] chain=${this.chainConfig.chainId} processed ${logs.length} CollectionCreated events up to block ${toBlock}`,
        );
      }
    } catch (error) {
      console.error(
        `[FactoryWatcher] chain=${this.chainConfig.chainId} error fetching logs from ${fromBlock} to ${toBlock}:`,
        error,
      );
    }
  }

  private async processLog(log: Log<bigint, number, false>): Promise<void> {
    try {
      const decoded = decodeEventLog({
        abi: FACTORY_EVENTS,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== 'CollectionCreated') return;

      const { collection, owner, name, symbol } = decoded.args as {
        collection: `0x${string}`;
        owner: `0x${string}`;
        name: string;
        symbol: string;
      };

      let royaltyReceiver: string | null = null;
      let royaltyBPS: number | null = null;
      try {
        const royalties = await this.client.readContract({
          address: collection,
          abi: COLLECTION_READ_ABI,
          functionName: 'getRoyalties',
          args: [0n],
        }) as [string[], bigint[]];
        if (royalties[0]!.length > 0) {
          royaltyReceiver = royalties[0]![0]!;
          royaltyBPS = Number(royalties[1]![0]);
        }
      } catch {
        console.warn(
          `[FactoryWatcher] chain=${this.chainConfig.chainId} could not read royalties for ${collection}`,
        );
      }

      const block = await this.client.getBlock({ blockNumber: log.blockNumber! });

      const collectionId = await processCollectionCreated(this.db, {
        chainId: this.chainConfig.chainId,
        factoryAddress: this.chainConfig.factoryAddress,
        contractAddress: collection,
        ownerAddress: owner,
        name,
        symbol,
        txHash: log.transactionHash!,
        blockNumber: Number(log.blockNumber),
        blockTimestamp: new Date(Number(block.timestamp) * 1000),
        fromAddress: log.transactionHash!,
        royaltyReceiver,
        royaltyBPS,
      });

      await upsertIndexedContract(this.db, {
        contractAddress: collection,
        chainId: this.chainConfig.chainId,
        lastIndexedBlock: Number(log.blockNumber),
        contractType: 'such_collection',
      });

      console.log(
        `[FactoryWatcher] chain=${this.chainConfig.chainId} discovered collection ${name} (${collection}) id=${collectionId}`,
      );
    } catch (error) {
      console.error(
        `[FactoryWatcher] chain=${this.chainConfig.chainId} error processing log ${log.transactionHash}:`,
        error,
      );
    }
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log(
      `[FactoryWatcher] chain=${this.chainConfig.chainId} started (poll every ${this.config.factoryPollInterval}ms)`,
    );
    while (this.isRunning) {
      try {
        await this.poll();
      } catch (error) {
        console.error(
          `[FactoryWatcher] chain=${this.chainConfig.chainId} poll error:`,
          error,
        );
      }
      await this.sleep(this.config.factoryPollInterval);
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
