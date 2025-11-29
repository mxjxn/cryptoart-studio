import { NextRequest, NextResponse } from "next/server";
import { getDatabase, creatorCoreContracts } from "@repo/db";
import { eq } from "drizzle-orm";
import { getSalesForCollection } from "@cryptoart/unified-indexer";
import { isAddress } from "viem";
import { CHAIN_ID } from "~/lib/contracts/marketplace";

interface RecognitionData {
  topCurator?: {
    collectorAddress: string;
    commissionsEarned: string;
    piecesSold: number;
  };
  mostSupportedArtist?: {
    artistFid: number;
    collectorCount: number;
    artistName?: string;
  };
  bestDiscovery?: {
    collectorAddress: string;
    discoveryCount: number;
    description: string;
  };
}

/**
 * Get recognition data (top curator, most supported artist, best discovery)
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
      return NextResponse.json({
        topCurator: null,
        mostSupportedArtist: null,
        bestDiscovery: null,
      });
    }

    // Track curator commissions (from referrer addresses in auctions)
    const curatorCommissions = new Map<string, { count: number; total: bigint }>();
    const artistSupport = new Map<number, Set<string>>();
    const discoveries = new Map<string, number>();

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

        // Process auctions for curator commissions and artist support
        sales.auctions.forEach((auction) => {
          if (auction.currentPrice) {
            // Track artist support (collectors who bid)
            if (collection.creatorFid) {
              if (!artistSupport.has(collection.creatorFid)) {
                artistSupport.set(collection.creatorFid, new Set());
              }
              artistSupport.get(collection.creatorFid)!.add(auction.seller);
            }

            // TODO: Track referrer addresses from auction bids for curator commissions
            // This would require querying bid events with referrer data
          }
        });
      } catch (error) {
        console.error(
          `Error processing collection ${collection.contractAddress}:`,
          error
        );
      }
    }

    // Find most supported artist
    let mostSupported: { artistFid: number; collectorCount: number } | null = null;
    artistSupport.forEach((collectors, artistFid) => {
      if (!mostSupported || collectors.size > mostSupported.collectorCount) {
        mostSupported = {
          artistFid,
          collectorCount: collectors.size,
        };
      }
    });

    // TODO: Implement curator commission tracking and discovery tracking
    // These would require additional data sources (bid events, purchase events with referrers)

    const recognition: RecognitionData = {
      mostSupportedArtist: mostSupported
        ? {
            artistFid: mostSupported.artistFid,
            collectorCount: mostSupported.collectorCount,
          }
        : undefined,
      // Placeholder for curator and discovery (requires additional data)
      topCurator: undefined,
      bestDiscovery: undefined,
    };

    return NextResponse.json(recognition);
  } catch (error) {
    console.error("Error fetching recognition:", error);
    return NextResponse.json({
      topCurator: null,
      mostSupportedArtist: null,
      bestDiscovery: null,
    });
  }
}

