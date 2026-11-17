import { NextResponse } from 'next/server';
import {
  indexAllContracts,
  getConfiguredContracts,
  resolveFactoryStartBlock,
  watchFactory,
  getDiscoveredCollections,
} from '@cryptoart/chain-indexer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max 60s on Vercel Pro

/** Leave headroom for factory watches + response within the 60s limit */
const MARKETPLACE_BUDGET_MS = 45_000;
const FACTORY_BUDGET_MS = 55_000;

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
  const marketplaceDeadline = startTime + MARKETPLACE_BUDGET_MS;
  const factoryDeadline = startTime + FACTORY_BUDGET_MS;
  const results: any[] = [];

  try {
    // Step 1: Index configured marketplace contracts (RPC + start block required)
    const contracts = getConfiguredContracts();
    console.log(`[Cron] Indexing ${contracts.length} marketplace contract(s)...`);
    const marketplaceResults = await indexAllContracts(contracts, {
      maxBlockRange: 2000,
      parallel: false,
      deadlineMs: marketplaceDeadline,
    });
    results.push(...marketplaceResults);

    // Step 2: Watch factories for new collections (multi-chain)
    // Supported chains: Base (8453), Base Sepolia (84532), Ethereum (1)
    const supportedChains = [8453, 84532, 1];
    const discovered: string[] = [];
    const collectionsPerChain: Record<number, number> = {};

    for (const chainId of supportedChains) {
      if (Date.now() >= factoryDeadline) {
        console.warn('[Cron] Time budget reached before factory watches; stopping early');
        break;
      }

      const factoryAddress = process.env[`CHAIN_${chainId}_FACTORY_ADDRESS`];
      const factory1155Address = process.env[`CHAIN_${chainId}_ERC1155_FACTORY_ADDRESS`];
      const rpcUrl = process.env[`CHAIN_${chainId}_RPC_URL`];

      // Skip chain if no RPC or no factory configured
      if (!rpcUrl || (!factoryAddress && !factory1155Address)) {
        continue;
      }

      // Factories have their own start block, independent of the marketplace's
      const startBlock = resolveFactoryStartBlock(chainId);
      if (startBlock === null) {
        console.warn(`[Cron] Skipping factories on chain ${chainId}: set CHAIN_${chainId}_FACTORY_START_BLOCK to a positive deploy block`);
        continue;
      }

      // Watch ERC721 factory if configured
      if (factoryAddress) {
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

      if (Date.now() >= factoryDeadline) {
        console.warn('[Cron] Time budget reached mid factory watches; stopping early');
        break;
      }

      // Watch ERC1155 factory if configured
      if (factory1155Address) {
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
