import { NextRequest, NextResponse } from "next/server";
import { getDatabase, creatorCoreContracts, creatorCoreTokens } from "@repo/db";
import { eq, and } from "drizzle-orm";
import { isAddress } from "viem";
import { getSalesForCollection } from "@cryptoart/unified-indexer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(request.url);
    const chainId = parseInt(searchParams.get("chainId") || "8453", 10);

    if (!isAddress(address)) {
      return NextResponse.json(
        { success: false, error: "Invalid address" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Get collection from indexed Creator Core contracts
    const [collection] = await db
      .select()
      .from(creatorCoreContracts)
      .where(
        and(
          eq(creatorCoreContracts.contractAddress, address.toLowerCase()),
          eq(creatorCoreContracts.chainId, chainId)
        )
      )
      .limit(1);

    if (!collection) {
      return NextResponse.json(
        { success: false, error: "Collection not found" },
        { status: 404 }
      );
    }

    // Get all tokens for this collection
    const tokens = await db
      .select()
      .from(creatorCoreTokens)
      .where(eq(creatorCoreTokens.contractAddress, address.toLowerCase()));

    // Get sales data to determine owner status
    let salesData: { pools: any[]; auctions: any[] } = { pools: [], auctions: [] };
    try {
      salesData = await getSalesForCollection(
        address as `0x${string}`,
        chainId,
        { first: 1000, skip: 0 }
      );
    } catch (error) {
      console.error("Error fetching sales data:", error);
      // Continue without sales data
    }

    // Enrich NFTs with owner status
    const enrichedNFTs = await Promise.all(
      tokens.map(async (token) => {
        const tokenId = token.tokenId;
        const metadata = token.metadata as any;

        // Check if on auction
        const onAuction = salesData.auctions.some(
          (auction) =>
            auction.tokenId === tokenId && auction.status === "ACTIVE"
        );

        // Check if in pool
        const inPool = salesData.pools.some(
          (pool) => pool.tokenId === tokenId && pool.status === "ACTIVE"
        );

        // Check if for sale (fixed price listing)
        const forSale = salesData.auctions.some(
          (auction) =>
            auction.tokenId === tokenId &&
            auction.status === "ACTIVE" &&
            auction.listingType === "FIXED_PRICE"
        );

        // Determine owner status
        let ownerStatus = token.currentOwner || "unknown";
        if (onAuction) {
          ownerStatus = "on auction";
        } else if (forSale) {
          ownerStatus = "for sale";
        } else if (inPool) {
          ownerStatus = "in pool";
        } else if (token.currentOwner) {
          // Use current owner from indexed data
          ownerStatus = token.currentOwner;
        }

        return {
          id: token.id,
          tokenId: token.tokenId,
          image: metadata?.image || metadata?.imageURI || null,
          name: metadata?.name || `Token #${tokenId}`,
          description: metadata?.description || null,
          ownerStatus: ownerStatus,
          createdAt: token.mintedAt?.toISOString() || new Date().toISOString(),
        };
      })
    );

    // Sort by date created (newest first)
    enrichedNFTs.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      success: true,
      collection: {
        id: collection.id,
        address: collection.contractAddress,
        name: collection.name,
        symbol: collection.symbol,
        contractType: collection.contractType,
        chainId: collection.chainId,
        isUpgradeable: collection.isUpgradeable,
        metadata: collection.metadata,
        defaultImage:
          collection.metadata &&
          typeof collection.metadata === "object" &&
          "defaultImage" in collection.metadata
            ? (collection.metadata as any).defaultImage
            : null,
        createdAt: collection.deployedAt?.toISOString() || null,
      },
      nfts: enrichedNFTs,
      count: enrichedNFTs.length,
    });
  } catch (error) {
    console.error("Error fetching collection:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch collection data",
      },
      { status: 500 }
    );
  }
}

