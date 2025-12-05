import { NextRequest, NextResponse } from "next/server";
import { request, gql } from "graphql-request";
import { getDatabase, contractCache, eq } from '@cryptoart/db';
import { getContractCreator } from "~/lib/contract-creator";
import { cacheContractInfo } from "~/lib/server/user-cache";
import { verifyAdmin } from "~/lib/server/admin";

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured');
};

const getSubgraphHeaders = (): Record<string, string> => {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}` };
  }
  return {};
};

// Query to get all unique contract addresses from listings
const ALL_CONTRACTS_QUERY = gql`
  query AllContracts($first: Int!, $skip: Int!) {
    listings(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      tokenAddress
    }
  }
`;

/**
 * POST /api/admin/backfill-contracts
 * 
 * One-time backfill to populate contractCache with creator addresses
 * for all contracts that have listings in the marketplace.
 * 
 * This enables the "artworks created" tab on user profiles to work.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify admin access
    const body = await req.json().catch(() => ({}));
    const { adminAddress } = body;
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    const endpoint = getSubgraphEndpoint();
    const db = getDatabase();
    
    // Fetch all unique contract addresses from listings
    console.log('[Backfill] Fetching all contracts from subgraph...');
    
    let allContracts: string[] = [];
    let skip = 0;
    const BATCH_SIZE = 1000;
    
    // Paginate through all listings to get unique contracts
    while (true) {
      const result = await request<{ listings: Array<{ tokenAddress: string }> }>(
        endpoint,
        ALL_CONTRACTS_QUERY,
        { first: BATCH_SIZE, skip },
        getSubgraphHeaders()
      );
      
      if (!result.listings || result.listings.length === 0) {
        break;
      }
      
      const addresses = result.listings.map(l => l.tokenAddress?.toLowerCase()).filter(Boolean);
      allContracts.push(...addresses);
      
      if (result.listings.length < BATCH_SIZE) {
        break;
      }
      
      skip += BATCH_SIZE;
    }
    
    // Deduplicate
    const uniqueContracts = Array.from(new Set(allContracts));
    console.log(`[Backfill] Found ${uniqueContracts.length} unique contracts`);
    
    // Check which contracts are not yet cached
    const existingContracts = await db.select({ contractAddress: contractCache.contractAddress })
      .from(contractCache);
    
    const existingSet = new Set(existingContracts.map(c => c.contractAddress.toLowerCase()));
    const contractsToBackfill = uniqueContracts.filter(addr => !existingSet.has(addr));
    
    console.log(`[Backfill] ${contractsToBackfill.length} contracts need backfill (${existingSet.size} already cached)`);
    
    // Look up and cache creators in batches
    const LOOKUP_BATCH_SIZE = 3; // Small batches to avoid rate limits
    let processed = 0;
    let cached = 0;
    let errors = 0;
    
    for (let i = 0; i < contractsToBackfill.length; i += LOOKUP_BATCH_SIZE) {
      const batch = contractsToBackfill.slice(i, i + LOOKUP_BATCH_SIZE);
      
      await Promise.all(
        batch.map(async (contractAddr) => {
          try {
            const creatorResult = await getContractCreator(contractAddr);
            if (creatorResult.creator) {
              await cacheContractInfo(contractAddr, {
                creatorAddress: creatorResult.creator,
                source: creatorResult.source === 'etherscan' ? 'etherscan' : 'onchain',
              });
              cached++;
            }
            processed++;
          } catch (error) {
            console.error(`[Backfill] Error for ${contractAddr}:`, error);
            errors++;
            processed++;
          }
        })
      );
      
      // Log progress every 10 contracts
      if (processed % 10 === 0 || processed === contractsToBackfill.length) {
        console.log(`[Backfill] Progress: ${processed}/${contractsToBackfill.length} (${cached} cached, ${errors} errors)`);
      }
      
      // Small delay between batches to be nice to APIs
      if (i + LOOKUP_BATCH_SIZE < contractsToBackfill.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    const duration = Date.now() - startTime;
    
    const summary = {
      success: true,
      totalContracts: uniqueContracts.length,
      alreadyCached: existingSet.size,
      backfilled: contractsToBackfill.length,
      newlyCached: cached,
      errors,
      durationMs: duration,
    };
    
    console.log('[Backfill] Complete:', summary);
    
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[Backfill] Fatal error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check status/preview
export async function GET(req: NextRequest) {
  try {
    // Verify admin access
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get('adminAddress');
    
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }
    
    const endpoint = getSubgraphEndpoint();
    const db = getDatabase();
    
    // Get count of contracts from subgraph (first page only for preview)
    const result = await request<{ listings: Array<{ tokenAddress: string }> }>(
      endpoint,
      ALL_CONTRACTS_QUERY,
      { first: 1000, skip: 0 },
      getSubgraphHeaders()
    );
    
    const uniqueContracts = Array.from(
      new Set(result.listings.map(l => l.tokenAddress?.toLowerCase()).filter(Boolean))
    );
    
    // Get count of cached contracts
    const cachedContracts = await db.select({ contractAddress: contractCache.contractAddress })
      .from(contractCache);
    
    const cachedSet = new Set(cachedContracts.map(c => c.contractAddress.toLowerCase()));
    const needsBackfill = uniqueContracts.filter(addr => !cachedSet.has(addr));
    
    return NextResponse.json({
      totalContractsInSubgraph: uniqueContracts.length,
      totalCachedContracts: cachedContracts.length,
      contractsNeedingBackfill: needsBackfill.length,
      note: 'POST to this endpoint to run the backfill',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

