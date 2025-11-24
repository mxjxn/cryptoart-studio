import { NextRequest, NextResponse } from "next/server";
import { getDatabase, creatorCoreContracts } from "@repo/db";
import { eq } from "drizzle-orm";
import { getSalesForCollection } from "@cryptoart/unified-indexer";
import { isAddress } from "viem";
import type { AuctionData } from "@cryptoart/unified-indexer";
import { CHAIN_ID } from "~/lib/contracts/marketplace";

interface EnrichedAuction extends AuctionData {
  collectionName?: string;
  collectionAddress?: string;
  artistFid?: number;
  artistName?: string;
  artistPfp?: string;
  nftImage?: string;
  nftName?: string;
}

/**
 * Get featured auction for hero section
 * Priority: Manual curation (featured flag) > Highest bid > Most recent active
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();
    
    // Get all collections
    const collections = await db
      .select()
      .from(creatorCoreContracts)
      .where(eq(creatorCoreContracts.chainId, CHAIN_ID));

    if (collections.length === 0) {
      return NextResponse.json({ auction: null });
    }

    // Fetch auctions for all collections
    const allAuctions: EnrichedAuction[] = [];
    
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

        // Filter for ACTIVE INDIVIDUAL_AUCTION only
        const activeAuctions = sales.auctions.filter(
          (auction) => 
            auction.status === "ACTIVE" && 
            auction.listingType === "INDIVIDUAL_AUCTION"
        );

        // Add collection metadata
        const enrichedAuctions = activeAuctions.map((auction) => ({
          ...auction,
          collectionName: collection.name,
          collectionAddress: collection.contractAddress,
          artistFid: collection.creatorFid,
        }));

        allAuctions.push(...enrichedAuctions);
      } catch (error) {
        console.error(
          `Error fetching auctions for collection ${collection.contractAddress}:`,
          error
        );
      }
    }

    if (allAuctions.length === 0) {
      return NextResponse.json({ auction: null });
    }

    // Sort by: currentPrice (highest first), then by endTime (soonest first)
    const now = Math.floor(Date.now() / 1000);
    const sortedAuctions = allAuctions.sort((a, b) => {
      const aPrice = a.currentPrice ? BigInt(a.currentPrice) : BigInt(0);
      const bPrice = b.currentPrice ? BigInt(b.currentPrice) : BigInt(0);
      
      if (aPrice > bPrice) return -1;
      if (aPrice < bPrice) return 1;
      
      // If prices equal, sort by endTime (soonest first)
      return parseInt(a.endTime) - parseInt(b.endTime);
    });

    // Return the top auction
    const featuredAuction = sortedAuctions[0];

    return NextResponse.json({ auction: featuredAuction });
  } catch (error) {
    console.error("Error fetching featured auction:", error);
    return NextResponse.json({ auction: null });
  }
}

