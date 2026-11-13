import { NextResponse } from 'next/server';
import {
  indexAllContracts,
  ALL_CONTRACTS,
  watchFactory,
  getDiscoveredCollections,
  indexContract,
  type ContractConfig,
} from '@cryptoart/chain-indexer';
import { MarketplaceLibABI } from '@cryptoart/chain-indexer/config/abis/MarketplaceLib';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max 60s on Vercel Pro

/**
 * Vercel Cron route for chain event indexing
 * Runs every minute to poll for new events
 * 
 * Authentication: Vercel automatically sets Authorization header with CRON_SECRET
 */
export async function GET(request: Request) {
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

    // Step 2: Watch factories for new collections (if configured)
    const factoryAddressBase = process.env.CHAIN_8453_FACTORY_ADDRESS;
    const factory1155AddressBase = process.env.CHAIN_8453_ERC1155_FACTORY_ADDRESS;
    const baseStartBlock = BigInt(process.env.CHAIN_8453_START_BLOCK || '0');

    const discovered: string[] = [];

    if (factoryAddressBase) {
      console.log('[Cron] Watching ERC721 factory...');
      const newCollections = await watchFactory(
        factoryAddressBase as `0x${string}`,
        8453,
        [], // Factory ABI not needed for CollectionCreated event
        baseStartBlock
      );
      discovered.push(...newCollections);
    }

    if (factory1155AddressBase) {
      console.log('[Cron] Watching ERC1155 factory...');
      const newCollections = await watchFactory(
        factory1155AddressBase as `0x${string}`,
        8453,
        [],
        baseStartBlock
      );
      discovered.push(...newCollections);
    }

    // Step 3: Index marketplace events on factory-discovered collections
    // (Collections that were created via factories and might have marketplace listings)
    if (discovered.length > 0) {
      console.log(`[Cron] Found ${discovered.length} new collections, indexing marketplace events...`);
    }

    // Get all discovered collections for this chain
    const collections = await getDiscoveredCollections(8453);
    
    // For now, only index the main marketplace contracts
    // In the future, could index per-collection marketplace events if they have their own listing contracts
    console.log(`[Cron] Tracking ${collections.length} collections on Base`);

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
      collectionsTracked: collections.length,
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
