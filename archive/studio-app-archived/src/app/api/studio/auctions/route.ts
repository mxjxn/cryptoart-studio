import { NextRequest, NextResponse } from "next/server";
import { getDatabase, creatorCoreContracts, eq, and } from "@cryptoart/db";
import { getSalesForCollection } from "@cryptoart/unified-indexer";
import { isAddress } from "viem";
import type { AuctionData } from "@cryptoart/unified-indexer";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorFid = searchParams.get("creatorFid");
    const chainId = parseInt(searchParams.get("chainId") || "8453", 10);

    // If no creatorFid, return empty array (not an error)
    if (!creatorFid) {
      return NextResponse.json({
        success: true,
        auctions: [],
        count: 0,
      });
    }

    const db = getDatabase();
    
    // Get all collections for this creator from indexed Creator Core contracts
    const collections = await db
      .select()
      .from(creatorCoreContracts)
      .where(
        and(
          eq(creatorCoreContracts.creatorFid, parseInt(creatorFid, 10)),
          eq(creatorCoreContracts.chainId, chainId)
        )
      );

    // If no collections, return empty array
    if (collections.length === 0) {
      return NextResponse.json({
        success: true,
        auctions: [],
        count: 0,
      });
    }

    // Fetch auctions for each collection
    const allAuctions: AuctionData[] = [];
    
    for (const collection of collections) {
      try {
        if (!isAddress(collection.contractAddress)) {
          continue;
        }

        const sales = await getSalesForCollection(
          collection.contractAddress as `0x${string}`,
          chainId,
          { first: 100, skip: 0 }
        );

        // Filter for ACTIVE auctions only
        const activeAuctions = sales.auctions.filter(
          (auction) => auction.status === "ACTIVE"
        );

        // Add collection metadata to each auction
        const enrichedAuctions = activeAuctions.map((auction) => ({
          ...auction,
          collectionName: collection.name,
          collectionAddress: collection.contractAddress,
        }));

        allAuctions.push(...enrichedAuctions);
      } catch (error) {
        console.error(
          `Error fetching auctions for collection ${collection.contractAddress}:`,
          error
        );
        // Continue with other collections
      }
    }

    // Sort: active auctions (countdown started) first
    // An auction is "active" (countdown started) if startTime is in the past
    const now = Math.floor(Date.now() / 1000);
    const sortedAuctions = allAuctions.sort((a, b) => {
      const aStarted = parseInt(a.startTime) > 0 && parseInt(a.startTime) <= now;
      const bStarted = parseInt(b.startTime) > 0 && parseInt(b.startTime) <= now;
      
      if (aStarted && !bStarted) return -1;
      if (!aStarted && bStarted) return 1;
      
      // If both started or both not started, sort by endTime (earliest first)
      return parseInt(a.endTime) - parseInt(b.endTime);
    });

    return NextResponse.json({
      success: true,
      auctions: sortedAuctions,
      count: sortedAuctions.length,
    });
  } catch (error) {
    console.error("Error fetching auctions:", error);
    // Return empty array on error instead of failing
    return NextResponse.json({
      success: true,
      auctions: [],
      count: 0,
    });
  }
}

