import { NextRequest, NextResponse } from "next/server";
import { getDatabase, creatorCoreContracts } from "@repo/db";
import { eq, sql } from "drizzle-orm";
import { getSalesForCollection } from "@cryptoart/unified-indexer";
import { isAddress, formatEther } from "viem";
import { CHAIN_ID } from "~/lib/contracts/marketplace";

/**
 * Get community stats (collectors, artists, volume)
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();
    
    // Get all collections
    const collections = await db
      .select()
      .from(creatorCoreContracts)
      .where(eq(creatorCoreContracts.chainId, CHAIN_ID));

    // Count unique artists
    const uniqueArtists = new Set<number>();
    collections.forEach((c) => {
      if (c.creatorFid) uniqueArtists.add(c.creatorFid);
    });

    // Count collectors and calculate volume
    const collectors = new Set<string>();
    let totalVolume = BigInt(0);
    const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

    for (const collection of collections) {
      try {
        if (!isAddress(collection.contractAddress)) {
          continue;
        }

        const sales = await getSalesForCollection(
          collection.contractAddress as `0x${string}`,
          CHAIN_ID,
          { first: 100, skip: 0 }
        );

        // Count collectors from auctions
        sales.auctions.forEach((auction) => {
          if (auction.currentPrice) {
            collectors.add(auction.seller);
            // Add to volume if recent
            const createdAt = parseInt(auction.createdAt);
            if (createdAt >= oneWeekAgo) {
              totalVolume += BigInt(auction.currentPrice);
            }
          }
        });

        // Count collectors from pools (using spotPrice as indicator)
        sales.pools.forEach((pool) => {
          if (pool.spotPrice && BigInt(pool.spotPrice) > 0) {
            // Estimate collectors from pool activity
            // TODO: Get actual collector count from pool transactions
          }
        });
      } catch (error) {
        console.error(
          `Error processing collection ${collection.contractAddress}:`,
          error
        );
      }
    }

    return NextResponse.json({
      collectors: collectors.size,
      artists: uniqueArtists.size,
      volume: totalVolume.toString(),
      volumeFormatted: formatEther(totalVolume),
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({
      collectors: 0,
      artists: 0,
      volume: "0",
      volumeFormatted: "0",
    });
  }
}


