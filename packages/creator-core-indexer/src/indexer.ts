/**
 * Main Creator Core Indexer Service
 * 
 * Indexes Creator Core contracts by:
 * 1. Monitoring for new contract deployments (by tracking known implementation addresses)
 * 2. Indexing Transfer events to detect mints and transfers
 * 3. Fetching and caching NFT metadata
 */

import { PublicClient, Address, Log } from 'viem';
import { getDatabase } from '@cryptoart/db';
import { eq } from 'drizzle-orm';
import { getConfig } from './config.js';
import { createClient, detectCreatorCoreContract } from './contracts.js';
import {
  processTransferEvent,
  processTransferSingleEvent,
  processTransferBatchEvent,
  storeTransfer,
} from './events.js';
import { fetchAndCacheMetadata } from './metadata.js';

// Event topic signatures
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TRANSFER_SINGLE_TOPIC = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';
const TRANSFER_BATCH_TOPIC = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb';
// ExtensionRegistered(address,address) - keccak256 hash
// TODO: Calculate actual topic hash from event signature
const EXTENSION_REGISTERED_TOPIC = '0x' + '0'.repeat(64); // Placeholder
// ExtensionUnregistered(address,address) - keccak256 hash  
// TODO: Calculate actual topic hash from event signature
const EXTENSION_UNREGISTERED_TOPIC = '0x' + '0'.repeat(64); // Placeholder

export class CreatorCoreIndexer {
  private client: PublicClient;
  private config: ReturnType<typeof getConfig>;
  private lastProcessedBlock: number;
  private isRunning: boolean = false;

  constructor() {
    this.config = getConfig();
    this.client = createClient(this.config.rpcUrl, this.config.chainId);
    this.lastProcessedBlock = this.config.startBlock || 0;
  }

  /**
   * Initialize indexer - get last processed block from database
   */
  async initialize(): Promise<void> {
    const db = getDatabase();
    
    // Get the highest block number from transfers table
    const result = await db
      .select({ maxBlock: creatorCoreTokens.mintedAtBlock })
      .from(creatorCoreTokens)
      .orderBy(creatorCoreTokens.mintedAtBlock)
      .limit(1);

    if (result.length > 0 && result[0].maxBlock) {
      this.lastProcessedBlock = result[0].maxBlock;
    } else if (this.config.startBlock) {
      this.lastProcessedBlock = this.config.startBlock;
    }

    console.log(`Indexer initialized. Starting from block: ${this.lastProcessedBlock}`);
  }

  /**
   * Get indexer status
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    lastProcessedBlock: number;
    currentBlock: number;
    blocksBehind: number;
  }> {
    const currentBlock = await this.client.getBlockNumber();
    return {
      isRunning: this.isRunning,
      lastProcessedBlock: this.lastProcessedBlock,
      currentBlock: Number(currentBlock),
      blocksBehind: Number(currentBlock) - this.lastProcessedBlock,
    };
  }

  /**
   * Start indexing loop
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Indexer is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting Creator Core Indexer...');
    console.log(`Starting from block: ${this.lastProcessedBlock}`);

    while (this.isRunning) {
      try {
        await this.indexNextBatch();
        await this.sleep(this.config.pollInterval);
      } catch (error) {
        console.error('Error in indexing loop:', error);
        await this.sleep(this.config.pollInterval * 2); // Wait longer on error
      }
    }
  }

  /**
   * Stop indexing
   */
  stop(): void {
    this.isRunning = false;
    console.log('Stopping Creator Core Indexer...');
  }

  /**
   * Index next batch of blocks
   */
  private async indexNextBatch(): Promise<void> {
    const currentBlock = await this.client.getBlockNumber();
    const toBlock = Math.min(
      Number(currentBlock),
      this.lastProcessedBlock + this.config.batchSize
    );

    if (toBlock <= this.lastProcessedBlock) {
      return; // No new blocks
    }

    console.log(`Indexing blocks ${this.lastProcessedBlock + 1} to ${toBlock}`);

    // Get all logs in this block range
    const logs = await this.client.getLogs({
      fromBlock: BigInt(this.lastProcessedBlock + 1),
      toBlock: BigInt(toBlock),
      topics: [
        [
          TRANSFER_TOPIC,
          TRANSFER_SINGLE_TOPIC,
          TRANSFER_BATCH_TOPIC,
          EXTENSION_REGISTERED_TOPIC,
          EXTENSION_UNREGISTERED_TOPIC,
        ],
      ],
    });

    // Process logs
    for (const log of logs) {
      await this.processLog(log);
    }

    // Update last processed block
    this.lastProcessedBlock = toBlock;
    console.log(`Indexed ${logs.length} events, now at block ${toBlock}`);
  }

  /**
   * Process a single log
   */
  private async processLog(log: Log): Promise<void> {
    try {
      const block = await this.client.getBlock({ blockNumber: log.blockNumber });
      const timestamp = new Date(Number(block.timestamp) * 1000);

      // Check if this is a known Creator Core contract
      const contractInfo = await this.ensureContractIndexed(log.address);

      if (!contractInfo) {
        return; // Not a Creator Core contract
      }

      // Process based on event type
      if (log.topics[0] === TRANSFER_TOPIC) {
        const transfer = processTransferEvent(log, timestamp);
        if (transfer) {
          await storeTransfer(transfer);
        }
      } else if (log.topics[0] === TRANSFER_SINGLE_TOPIC) {
        const transfer = processTransferSingleEvent(log, timestamp);
        if (transfer) {
          await storeTransfer(transfer);
        }
      } else if (log.topics[0] === TRANSFER_BATCH_TOPIC) {
        const transfers = processTransferBatchEvent(log, timestamp);
        for (const transfer of transfers) {
          await storeTransfer(transfer);
        }
      }
    } catch (error) {
      console.error(`Error processing log ${log.transactionHash}:`, error);
    }
  }

  /**
   * Ensure contract is indexed in database
   */
  private async ensureContractIndexed(address: string): Promise<boolean> {
    const db = getDatabase();
    const normalizedAddress = address.toLowerCase();

    // Check if already indexed
    const existing = await db
      .select()
      .from(creatorCoreContracts)
      .where(eq(creatorCoreContracts.contractAddress, normalizedAddress))
      .limit(1);

    if (existing.length > 0) {
      return true; // Already indexed
    }

    // Detect if it's a Creator Core contract
    const contractInfo = await detectCreatorCoreContract(this.client, normalizedAddress);
    if (!contractInfo) {
      return false; // Not a Creator Core contract
    }

    // Get block info for deployment
    const code = await this.client.getBytecode({ address: address as Address });
    if (!code || code === '0x') {
      return false; // Not a contract
    }

    // Store contract in database
    await db.insert(creatorCoreContracts).values({
      contractAddress: normalizedAddress,
      contractType: contractInfo.type,
      name: contractInfo.name,
      symbol: contractInfo.symbol,
      deployerAddress: contractInfo.owner || '', // TODO: Get actual deployer from transaction
      isUpgradeable: contractInfo.isUpgradeable,
      implementationAddress: contractInfo.implementationAddress,
      proxyAdminAddress: contractInfo.proxyAdminAddress,
      chainId: this.config.chainId,
      // deployedAt and deployedAtBlock will be set when we track the deployment transaction
    });

    console.log(`Indexed new Creator Core contract: ${normalizedAddress} (${contractInfo.type})`);
    return true;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Entry point logic moved to index.ts

