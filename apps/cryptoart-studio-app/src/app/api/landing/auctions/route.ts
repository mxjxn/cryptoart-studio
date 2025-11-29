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
 * Get auctions with filters
 * Query params: type (featured|active|ending|community), limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "active";
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const db = getDatabase();
    
    // Get all collections
    const collections = await db
      .select()
      .from(creatorCoreContracts)
      .where(eq(creatorCoreContracts.chainId, CHAIN_ID));

    if (collections.length === 0) {
      return NextResponse.json({ auctions: [], count: 0 });
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
          { first: 50, skip: 0 }
        );

        // Filter for ACTIVE auctions
        const activeAuctions = sales.auctions.filter(
          (auction) => auction.status === "ACTIVE"
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
      return NextResponse.json({ auctions: [], count: 0 });
    }

    const now = Math.floor(Date.now() / 1000);
    let filteredAuctions = allAuctions;

    // Apply filters based on type
    switch (type) {
      case "featured":
        // Featured: highest bid, active auctions
        filteredAuctions = allAuctions
          .filter((a) => {
            const startTime = parseInt(a.startTime);
            return startTime > 0 && startTime <= now;
          })
          .sort((a, b) => {
            const aPrice = a.currentPrice ? BigInt(a.currentPrice) : BigInt(0);
            const bPrice = b.currentPrice ? BigInt(b.currentPrice) : BigInt(0);
            if (aPrice > bPrice) return -1;
            if (aPrice < bPrice) return 1;
            return parseInt(a.endTime) - parseInt(b.endTime);
          })
          .slice(0, 5);
        break;

      case "ending":
        // Ending soon: sort by endTime ascending
        filteredAuctions = allAuctions
          .filter((a) => {
            const endTime = parseInt(a.endTime);
            return endTime > now;
          })
          .sort((a, b) => parseInt(a.endTime) - parseInt(b.endTime));
        break;

      case "active":
      default:
        // Active: started auctions, sorted by endTime
        filteredAuctions = allAuctions
          .filter((a) => {
            const startTime = parseInt(a.startTime);
            return startTime > 0 && startTime <= now;
          })
          .sort((a, b) => parseInt(a.endTime) - parseInt(b.endTime));
        break;
    }

    // Apply pagination
    const paginatedAuctions = filteredAuctions.slice(offset, offset + limit);

    return NextResponse.json({
      auctions: paginatedAuctions,
      count: filteredAuctions.length,
      total: allAuctions.length,
    });
  } catch (error) {
    console.error("Error fetching auctions:", error);
    return NextResponse.json({ auctions: [], count: 0, total: 0 });
  }
}

