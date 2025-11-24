import { NextRequest, NextResponse } from "next/server";
import { getDatabase, creatorCoreContracts } from "@repo/db";
import { eq, desc, sql } from "drizzle-orm";
import { getSalesForCollection } from "@cryptoart/unified-indexer";
import { isAddress } from "viem";
import { CHAIN_ID } from "~/lib/contracts/marketplace";

interface ArtistStats {
  artistFid: number;
  artistName?: string;
  artistPfp?: string;
  collectionCount: number;
  totalVolume: string;
  collectorCount: number;
  newestPiece?: {
    collectionAddress: string;
    tokenId?: string;
    createdAt: string;
  };
}

/**
 * Get featured artists (most collected this week)
 * Returns artists sorted by collector count and volume
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "4");

    const db = getDatabase();
    
    // Get all collections grouped by creator
    const collections = await db
      .select()
      .from(creatorCoreContracts)
      .where(eq(creatorCoreContracts.chainId, CHAIN_ID));

    if (collections.length === 0) {
      return NextResponse.json({ artists: [] });
    }

    // Group collections by creatorFid
    const artistMap = new Map<number, ArtistStats>();

    for (const collection of collections) {
      if (!collection.creatorFid) continue;

      if (!artistMap.has(collection.creatorFid)) {
        artistMap.set(collection.creatorFid, {
          artistFid: collection.creatorFid,
          collectionCount: 0,
          totalVolume: "0",
          collectorCount: 0,
        });
      }

      const artist = artistMap.get(collection.creatorFid)!;
      artist.collectionCount++;

      // Fetch sales to calculate volume and collectors
      try {
        if (isAddress(collection.contractAddress)) {
          const sales = await getSalesForCollection(
            collection.contractAddress as `0x${string}`,
            CHAIN_ID,
            { first: 100, skip: 0 }
          );

          // Count unique collectors from auctions
          const collectors = new Set<string>();
          sales.auctions.forEach((auction) => {
            if (auction.currentPrice) {
              collectors.add(auction.seller);
            }
          });

          artist.collectorCount += collectors.size;

          // Sum volume (currentPrice from active auctions)
          sales.auctions.forEach((auction) => {
            if (auction.currentPrice) {
              artist.totalVolume = (
                BigInt(artist.totalVolume) + BigInt(auction.currentPrice)
              ).toString();
            }
          });

          // Track newest piece
          if (sales.auctions.length > 0) {
            const newestAuction = sales.auctions.sort(
              (a, b) => parseInt(b.createdAt) - parseInt(a.createdAt)
            )[0];
            
            if (!artist.newestPiece || 
                parseInt(newestAuction.createdAt) > parseInt(artist.newestPiece.createdAt)) {
              artist.newestPiece = {
                collectionAddress: collection.contractAddress,
                tokenId: newestAuction.tokenId,
                createdAt: newestAuction.createdAt,
              };
            }
          }
        }
      } catch (error) {
        console.error(
          `Error processing collection ${collection.contractAddress}:`,
          error
        );
      }
    }

    // Sort by collector count, then volume
    const artists = Array.from(artistMap.values())
      .sort((a, b) => {
        if (b.collectorCount !== a.collectorCount) {
          return b.collectorCount - a.collectorCount;
        }
        return BigInt(b.totalVolume) > BigInt(a.totalVolume) ? 1 : -1;
      })
      .slice(0, limit);

    return NextResponse.json({ artists });
  } catch (error) {
    console.error("Error fetching featured artists:", error);
    return NextResponse.json({ artists: [] });
  }
}

