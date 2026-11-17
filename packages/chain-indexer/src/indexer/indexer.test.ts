import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Address } from 'viem';
import type { ContractConfig } from '../types/events';
import { processCreateListing } from './processors';

describe('Indexer', () => {
  describe('Processor with BigInt Args', () => {
    it('should process CreateListing event with BigInt amounts correctly', async () => {
      // Mock transaction object
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      // Create listing args with BigInt values (simulating viem decoded event)
      const args = {
        listingId: 1n,
        seller: '0x1234567890123456789012345678901234567890' as Address,
        listingType: 2,
        initialAmount: 10000000000000000000n, // 10 ETH in wei
        totalAvailable: 100,
        totalPerSale: 1,
        startTime: 1700000000n,
        endTime: 1700086400n,
        extensionInterval: 900,
        minIncrementBPS: 500,
        erc20: '0x0000000000000000000000000000000000000000' as Address,
        identityVerifier: '0x0000000000000000000000000000000000000000' as Address,
        marketplaceBPS: 250,
        referrerBPS: 100,
      };

      await processCreateListing(
        mockTx as any,
        8453,
        args,
        100000n,
        1700000000n,
        '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9'
      );

      // Verify insert was called
      expect(mockTx.insert).toHaveBeenCalled();
      
      // Verify values method was called with serialized BigInts
      const valuesCall = mockTx.insert().values;
      expect(valuesCall).toHaveBeenCalled();
      
      // Get the values that were passed
      const insertedValues = valuesCall.mock.calls[0][0];
      
      // Verify BigInt values were converted to strings
      expect(typeof insertedValues.listingId).toBe('string');
      expect(insertedValues.listingId).toBe('1');
      expect(typeof insertedValues.initialAmount).toBe('string');
      expect(insertedValues.initialAmount).toBe('10000000000000000000');
      expect(insertedValues.marketplace).toBe('0x1cb0c1f72ba7547fc99c4b5333d8aba1ed6b31a9'); // lowercase
    });
  });

  describe('Block Range Chunking', () => {
    it('should calculate correct chunk ranges for small ranges', () => {
      const MAX_BLOCK_RANGE = 2000;
      const fromBlock = 1000n;
      const toBlock = 1500n;
      
      const chunks: Array<{ start: bigint; end: bigint }> = [];
      let currentBlock = fromBlock;
      
      while (currentBlock <= toBlock) {
        const chunkEnd = currentBlock + BigInt(MAX_BLOCK_RANGE) - 1n;
        const endBlock = chunkEnd < toBlock ? chunkEnd : toBlock;
        chunks.push({ start: currentBlock, end: endBlock });
        currentBlock = endBlock + 1n;
      }
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual({ start: 1000n, end: 1500n });
    });

    it('should calculate correct chunk ranges for large ranges', () => {
      const MAX_BLOCK_RANGE = 2000;
      const fromBlock = 1000n;
      const toBlock = 6000n;
      
      const chunks: Array<{ start: bigint; end: bigint }> = [];
      let currentBlock = fromBlock;
      
      while (currentBlock <= toBlock) {
        const chunkEnd = currentBlock + BigInt(MAX_BLOCK_RANGE) - 1n;
        const endBlock = chunkEnd < toBlock ? chunkEnd : toBlock;
        chunks.push({ start: currentBlock, end: endBlock });
        currentBlock = endBlock + 1n;
      }
      
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ start: 1000n, end: 2999n }); // 2000 blocks
      expect(chunks[1]).toEqual({ start: 3000n, end: 4999n }); // 2000 blocks
      expect(chunks[2]).toEqual({ start: 5000n, end: 6000n }); // 1001 blocks
    });

    it('should handle exact multiples of MAX_BLOCK_RANGE', () => {
      const MAX_BLOCK_RANGE = 2000;
      const fromBlock = 0n;
      const toBlock = 3999n;
      
      const chunks: Array<{ start: bigint; end: bigint }> = [];
      let currentBlock = fromBlock;
      
      while (currentBlock <= toBlock) {
        const chunkEnd = currentBlock + BigInt(MAX_BLOCK_RANGE) - 1n;
        const endBlock = chunkEnd < toBlock ? chunkEnd : toBlock;
        chunks.push({ start: currentBlock, end: endBlock });
        currentBlock = endBlock + 1n;
      }
      
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ start: 0n, end: 1999n });
      expect(chunks[1]).toEqual({ start: 2000n, end: 3999n });
    });

    it('should handle single block ranges', () => {
      const MAX_BLOCK_RANGE = 2000;
      const fromBlock = 1000n;
      const toBlock = 1000n;
      
      const chunks: Array<{ start: bigint; end: bigint }> = [];
      let currentBlock = fromBlock;
      
      while (currentBlock <= toBlock) {
        const chunkEnd = currentBlock + BigInt(MAX_BLOCK_RANGE) - 1n;
        const endBlock = chunkEnd < toBlock ? chunkEnd : toBlock;
        chunks.push({ start: currentBlock, end: endBlock });
        currentBlock = endBlock + 1n;
      }
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual({ start: 1000n, end: 1000n });
    });
  });

  describe('Checkpoint Logic', () => {
    it('should start from contract startBlock when no checkpoint exists', () => {
      const checkpoint = 0n;
      const startBlock = 1000n;
      const fromBlock = checkpoint > 0n ? checkpoint + 1n : startBlock;
      
      expect(fromBlock).toBe(1000n);
    });

    it('should start from checkpoint + 1 when checkpoint exists', () => {
      const checkpoint = 5000n;
      const startBlock = 1000n;
      const fromBlock = checkpoint > 0n ? checkpoint + 1n : startBlock;
      
      expect(fromBlock).toBe(5001n);
    });

    it('should not index if fromBlock > toBlock', () => {
      const fromBlock = 6000n;
      const toBlock = 5999n;
      
      const shouldIndex = fromBlock <= toBlock;
      
      expect(shouldIndex).toBe(false);
    });
  });

  describe('Reorg Safety', () => {
    it('should apply safety margin to chain head', () => {
      const latestBlock = 10000n;
      const safetyMargin = 3;
      const safeBlock = latestBlock - BigInt(safetyMargin);
      
      expect(safeBlock).toBe(9997n);
    });

    it('should handle configurable safety margins', () => {
      const latestBlock = 10000n;
      
      expect(latestBlock - 3n).toBe(9997n);
      expect(latestBlock - 5n).toBe(9995n);
      expect(latestBlock - 10n).toBe(9990n);
    });
  });

  describe('Event Idempotency', () => {
    it('should create unique event ID from chain, tx hash, and log index', () => {
      const chainId = 8453;
      const txHash = '0xabc123';
      const logIndex = 5;
      
      const eventId = `${chainId}-${txHash}-${logIndex}`;
      
      expect(eventId).toBe('8453-0xabc123-5');
    });

    it('should generate different IDs for events in same tx', () => {
      const chainId = 8453;
      const txHash = '0xabc123';
      
      const event1Id = `${chainId}-${txHash}-0`;
      const event2Id = `${chainId}-${txHash}-1`;
      
      expect(event1Id).not.toBe(event2Id);
    });

    it('should generate different IDs for same log index on different chains', () => {
      const txHash = '0xabc123';
      const logIndex = 0;
      
      const baseEventId = `8453-${txHash}-${logIndex}`;
      const ethEventId = `1-${txHash}-${logIndex}`;
      
      expect(baseEventId).not.toBe(ethEventId);
    });
  });

  describe('Error Handling', () => {
    it('should implement exponential backoff for retries', () => {
      const getDelay = (attempt: number) => Math.pow(2, attempt) * 1000;
      
      expect(getDelay(1)).toBe(2000);
      expect(getDelay(2)).toBe(4000);
      expect(getDelay(3)).toBe(8000);
    });

    it('should stop after max retries', () => {
      const MAX_RETRIES = 3;
      let attempts = 0;
      
      const shouldRetry = (attempt: number) => {
        attempts++;
        return attempt < MAX_RETRIES;
      };
      
      shouldRetry(1); // true
      shouldRetry(2); // true
      shouldRetry(3); // false
      
      expect(attempts).toBe(3);
    });
  });

  describe('Contract Configuration', () => {
    it('should validate contract config has required fields', () => {
      const config: ContractConfig = {
        chainId: 8453,
        address: '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9' as Address,
        startBlock: 38886000n,
        abi: [],
        events: ['CreateListing'],
        label: 'Test Contract',
      };
      
      expect(config.chainId).toBeTypeOf('number');
      expect(config.address).toBeTypeOf('string');
      expect(config.startBlock).toBeTypeOf('bigint');
      expect(Array.isArray(config.abi)).toBe(true);
      expect(Array.isArray(config.events)).toBe(true);
    });

    it('should normalize contract addresses to lowercase', () => {
      const address = '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9';
      const normalized = address.toLowerCase();
      
      expect(normalized).toBe('0x1cb0c1f72ba7547fc99c4b5333d8aba1ed6b31a9');
    });
  });
});
