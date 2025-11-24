import { NextRequest, NextResponse } from "next/server";
import { getDatabase, creatorCoreContracts } from "@repo/db";
import { eq } from "drizzle-orm";
import { getSalesForCollection } from "@cryptoart/unified-indexer";
import { isAddress } from "viem";
import type { PoolData } from "@cryptoart/unified-indexer";
import { CHAIN_ID } from "~/lib/contracts/marketplace";

interface EnrichedPool extends PoolData {
  collectionName?: string;
  artistFid?: number;
  collectorCount?: number;
  volumeThisWeek?: string;
}

/**
 * Get featured NFT LP pools
 * Returns pools sorted by collector count and volume
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "5");

    const db = getDatabase();
    
    // Get all collections
    const collections = await db
      .select()
      .from(creatorCoreContracts)
      .where(eq(creatorCoreContracts.chainId, CHAIN_ID));

    if (collections.length === 0) {
      return NextResponse.json({ pools: [] });
    }

    // Fetch pools for all collections
    const allPools: EnrichedPool[] = [];
    
    for (const collection of collections) {
      try {
        if (!isAddress(collection.contractAddress)) {
          continue;
        }

        const sales = await getSalesForCollection(
          collection.contractAddress as `0x${string}`,
          CHAIN_ID,
          { first: 10, skip: 0 }
        );

        // Add collection metadata to pools
        const enrichedPools = sales.pools.map((pool) => ({
          ...pool,
          collectionName: collection.name,
          artistFid: collection.creatorFid,
          // TODO: Calculate collector count and volume from pool transactions
          collectorCount: 0,
          volumeThisWeek: "0",
        }));

        allPools.push(...enrichedPools);
      } catch (error) {
        console.error(
          `Error fetching pools for collection ${collection.contractAddress}:`,
          error
        );
      }
    }

    if (allPools.length === 0) {
      return NextResponse.json({ pools: [] });
    }

    // Sort by spotPrice (floor price) descending, then by collector count
    const sortedPools = allPools
      .sort((a, b) => {
        const aPrice = BigInt(a.spotPrice);
        const bPrice = BigInt(b.spotPrice);
        if (bPrice > aPrice) return 1;
        if (bPrice < aPrice) return -1;
        return (b.collectorCount || 0) - (a.collectorCount || 0);
      })
      .slice(0, limit);

    return NextResponse.json({ pools: sortedPools });
  } catch (error) {
    console.error("Error fetching pools:", error);
    return NextResponse.json({ pools: [] });
  }
}

