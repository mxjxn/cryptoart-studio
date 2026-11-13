import { NextResponse } from 'next/server';
import {
  indexAllContracts,
  ALL_CONTRACTS,
  watchFactory,
  getDiscoveredCollections,
  indexContract,
  type ContractConfig,
} from '@cryptoart/chain-indexer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max 60s on Vercel Pro

/**
 * Vercel Cron route for chain event indexing
 * Runs every minute to poll for new events
 * 
 * Authentication: Vercel automatically sets Authorization header with CRON_SECRET
 */
export async function GET(request: Request) {
  // Verify cron secret is configured
  if (!process.env.CRON_SECRET) {
    console.error('[Cron] CRON_SECRET is not set');
    return NextResponse.json(
      { error: 'Server configuration error: CRON_SECRET not set' },
      { status: 500 }
    );
  }

  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (authHeader !== expectedAuth) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  const results: any[] = [];

  try {
    // Step 1: Index configured marketplace contracts
    console.log('[Cron] Indexing marketplace contracts...');
    const marketplaceResults = await indexAllContracts(ALL_CONTRACTS, {
      maxBlockRange: 2000,
      parallel: false, // Sequential to avoid rate limits
    });
    results.push(...marketplaceResults);

    // Step 2: Watch factories for new collections (multi-chain)
    // Supported chains: Base (8453), Base Sepolia (84532), Ethereum (1)
    const supportedChains = [8453, 84532, 1];
    const discovered: string[] = [];
    const collectionsPerChain: Record<number, number> = {};

    for (const chainId of supportedChains) {
      const factoryAddress = process.env[`CHAIN_${chainId}_FACTORY_ADDRESS`];
      const factory1155Address = process.env[`CHAIN_${chainId}_ERC1155_FACTORY_ADDRESS`];
      const startBlockStr = process.env[`CHAIN_${chainId}_START_BLOCK`];
      const rpcUrl = process.env[`CHAIN_${chainId}_RPC_URL`];

      // Skip chain if not configured
      if (!rpcUrl) {
        continue;
      }

      // Watch ERC721 factory if configured
      if (factoryAddress && startBlockStr) {
        const startBlock = BigInt(startBlockStr);
        console.log(`[Cron] Watching ERC721 factory on chain ${chainId}...`);
        try {
          const newCollections = await watchFactory(
            factoryAddress as `0x${string}`,
            chainId,
            [],
            startBlock
          );
          discovered.push(...newCollections);
        } catch (error) {
          console.error(`[Cron] Error watching ERC721 factory on chain ${chainId}:`, error);
        }
      }

      // Watch ERC1155 factory if configured
      if (factory1155Address && startBlockStr) {
        const startBlock = BigInt(startBlockStr);
        console.log(`[Cron] Watching ERC1155 factory on chain ${chainId}...`);
        try {
          const newCollections = await watchFactory(
            factory1155Address as `0x${string}`,
            chainId,
            [],
            startBlock
          );
          discovered.push(...newCollections);
        } catch (error) {
          console.error(`[Cron] Error watching ERC1155 factory on chain ${chainId}:`, error);
        }
      }

      // Track collections per chain
      const collections = await getDiscoveredCollections(chainId);
      collectionsPerChain[chainId] = collections.length;
      console.log(`[Cron] Tracking ${collections.length} collections on chain ${chainId}`);
    }

    const timeTaken = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timeTaken,
      results: results.map((r) => ({
        contract: r.contract,
        chainId: r.chainId,
        blocks: `${r.startBlock}-${r.endBlock}`,
        eventsIndexed: r.eventsIndexed,
        timeTaken: r.timeTaken,
        errors: r.errors,
      })),
      discovered,
      collectionsPerChain,
    });
  } catch (error) {
    console.error('[Cron] Indexing error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timeTaken: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
