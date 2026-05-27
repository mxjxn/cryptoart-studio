import type { PublicClient } from 'viem';
import { decodeEventLog, type Log } from 'viem';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getDatabase } from '@cryptoart/db';
import { COLLECTION_EVENTS, COLLECTION_READ_ABI } from './abis.js';
import type { IndexerConfig, ChainConfig } from './config.js';
import {
  loadActiveCollections,
  updateCursor,
  markContractError,
  type IndexedContract,
} from './state.js';
import {
  getCollectionId,
  processTransfer,
  processMinted,
  processExtensionRegistered,
  processExtensionUnregistered,
  processRoyaltyUpdated,
  processBaseURIUpdated,
  processOwnershipTransferred,
  updateTotalSupply,
} from './processors.js';
import type { ProcessContext } from './processors.js';

export class CollectionScanner {
  private db: PostgresJsDatabase<Record<string, never>>;
  private client: PublicClient;
  private chainConfig: ChainConfig;
  private config: IndexerConfig;
  private isRunning = false;
  private errorCounts = new Map<string, number>();
  private static readonly MAX_CONSECUTIVE_ERRORS = 10;

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

  async poll(): Promise<void> {
    const activeCollections = await loadActiveCollections(
      this.db,
      this.chainConfig.chainId,
    );

    if (activeCollections.length === 0) return;

    const head = await this.client.getBlockNumber();

    for (const contract of activeCollections) {
      try {
        await this.processCollection(contract, head);
        this.errorCounts.delete(contract.contractAddress);
      } catch (error) {
        const count = (this.errorCounts.get(contract.contractAddress) ?? 0) + 1;
        this.errorCounts.set(contract.contractAddress, count);

        console.error(
          `[CollectionScanner] chain=${this.chainConfig.chainId} error processing ${contract.contractAddress} (attempt ${count}):`,
          error,
        );

        if (count >= CollectionScanner.MAX_CONSECUTIVE_ERRORS) {
          console.error(
            `[CollectionScanner] chain=${this.chainConfig.chainId} marking ${contract.contractAddress} as error after ${count} consecutive failures`,
          );
          await markContractError(
            this.db,
            contract.contractAddress,
            this.chainConfig.chainId,
            String(error),
          );
          this.errorCounts.delete(contract.contractAddress);
        }
      }
    }
  }

  private async processCollection(
    contract: IndexedContract,
    head: bigint,
  ): Promise<void> {
    const fromBlock = BigInt(contract.lastIndexedBlock) + 1n;
    const batchEnd = fromBlock + BigInt(this.config.batchSize) - 1n;
    const toBlock = head > batchEnd ? batchEnd : head;

    if (fromBlock > toBlock) return;

    const logs = await this.client.getLogs({
      address: contract.contractAddress as `0x${string}`,
      fromBlock,
      toBlock,
      events: COLLECTION_EVENTS,
    });

    if (logs.length === 0) {
      await updateCursor(
        this.db,
        contract.contractAddress,
        this.chainConfig.chainId,
        Number(toBlock),
      );
      return;
    }

    const collectionId = await getCollectionId(
      this.db,
      contract.contractAddress,
      this.chainConfig.chainId,
    );
    if (!collectionId) {
      console.warn(
        `[CollectionScanner] chain=${this.chainConfig.chainId} no collection row for ${contract.contractAddress}, skipping`,
      );
      return;
    }

    const blockTimestampCache = new Map<bigint, number>();

    for (const log of logs) {
      try {
        const blockTimestamp = await this.getBlockTimestamp(log.blockNumber!, blockTimestampCache);

        const ctx: ProcessContext = {
          db: this.db,
          collectionId,
          chainId: this.chainConfig.chainId,
          contractAddress: contract.contractAddress,
          txHash: log.transactionHash ?? '',
          blockNumber: Number(log.blockNumber),
          logIndex: log.logIndex,
          blockTimestamp: new Date(blockTimestamp),
        };

        await this.routeLog(ctx, log);
      } catch (error) {
        console.error(
          `[CollectionScanner] chain=${this.chainConfig.chainId} error processing log in tx ${log.transactionHash}:`,
          error,
        );
      }
    }

    try {
      const totalSupply = await this.client.readContract({
        address: contract.contractAddress as `0x${string}`,
        abi: COLLECTION_READ_ABI,
        functionName: 'totalSupply',
      }) as bigint;
      await updateTotalSupply(this.db, collectionId, Number(totalSupply));
    } catch {
      console.warn(
        `[CollectionScanner] chain=${this.chainConfig.chainId} could not read totalSupply for ${contract.contractAddress}`,
      );
    }

    await updateCursor(
      this.db,
      contract.contractAddress,
      this.chainConfig.chainId,
      Number(toBlock),
    );

    console.log(
      `[CollectionScanner] chain=${this.chainConfig.chainId} processed ${logs.length} events for ${contract.contractAddress} up to block ${toBlock}`,
    );
  }

  private async routeLog(ctx: ProcessContext, log: Log<bigint, number, false>): Promise<void> {
    const decoded = decodeEventLog({
      abi: COLLECTION_EVENTS,
      data: log.data,
      topics: log.topics,
    });

    switch (decoded.eventName) {
      case 'Transfer': {
        const args = decoded.args as { from: `0x${string}`; to: `0x${string}`; tokenId: bigint };
        await processTransfer(ctx, args.from, args.to, Number(args.tokenId));
        break;
      }
      case 'Minted': {
        const args = decoded.args as { to: `0x${string}`; tokenId: bigint; tokenURI: string };
        await processMinted(ctx, args.to, Number(args.tokenId), args.tokenURI);
        break;
      }
      case 'ExtensionRegistered': {
        const args = decoded.args as { extension: `0x${string}`; sender: `0x${string}` };
        await processExtensionRegistered(ctx, args.extension);
        break;
      }
      case 'ExtensionUnregistered': {
        const args = decoded.args as { extension: `0x${string}`; sender: `0x${string}` };
        await processExtensionUnregistered(ctx, args.extension);
        break;
      }
      case 'RoyaltyUpdated': {
        const args = decoded.args as { receiver: `0x${string}`; bps: number };
        await processRoyaltyUpdated(ctx, args.receiver, args.bps);
        break;
      }
      case 'BaseURIUpdated': {
        await processBaseURIUpdated(ctx);
        break;
      }
      case 'OwnershipTransferred': {
        const args = decoded.args as { previousOwner: `0x${string}`; newOwner: `0x${string}` };
        await processOwnershipTransferred(ctx, args.newOwner);
        break;
      }
    }
  }

  private async getBlockTimestamp(
    blockNumber: bigint,
    cache: Map<bigint, number>,
  ): Promise<number> {
    const cached = cache.get(blockNumber);
    if (cached !== undefined) return cached;

    const block = await this.client.getBlock({ blockNumber });
    const timestamp = Number(block.timestamp) * 1000;
    cache.set(blockNumber, timestamp);
    return timestamp;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log(
      `[CollectionScanner] chain=${this.chainConfig.chainId} started (poll every ${this.config.collectionPollInterval}ms)`,
    );
    while (this.isRunning) {
      try {
        await this.poll();
      } catch (error) {
        console.error(
          `[CollectionScanner] chain=${this.chainConfig.chainId} poll error:`,
          error,
        );
      }
      await this.sleep(this.config.collectionPollInterval);
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
