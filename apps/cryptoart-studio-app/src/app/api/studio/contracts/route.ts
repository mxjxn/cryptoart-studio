import { NextRequest, NextResponse } from "next/server";
import { getDatabase, creatorCoreContracts, nftCollections, eq } from "@repo/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();
    const { searchParams } = new URL(request.url);
    const creatorFid = searchParams.get("creatorFid");

    // Build query conditionally
    const baseQuery = db.select().from(creatorCoreContracts);
    const contracts = creatorFid
      ? await baseQuery.where(eq(creatorCoreContracts.creatorFid, parseInt(creatorFid)))
      : await baseQuery;

    return NextResponse.json({
      success: true,
      collections: contracts.map((c) => ({
        id: c.id,
        address: c.contractAddress,
        name: c.name,
        symbol: c.symbol,
        contractType: c.contractType,
        chainId: c.chainId,
        isUpgradeable: c.isUpgradeable,
        metadata: c.metadata,
        createdAt: c.deployedAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch collections" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, name, symbol, contractType, chainId, creatorFid, deployTxHash, metadata, salesMethod } = body;

    if (!address || !contractType || !chainId || !name || !symbol) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // Merge salesMethod into metadata if provided
    const collectionMetadata = {
      ...(metadata || {}),
      ...(salesMethod ? { salesMethod } : {}),
    };

    const [collection] = await db
      .insert(nftCollections)
      .values({
        creatorFid: creatorFid || 0, // TODO: Get from auth context
        contractAddress: address.toLowerCase(),
        name: name,
        symbol: symbol,
        contractType: contractType,
        chain: chainId,
        deployTxHash: deployTxHash || null,
        metadata: Object.keys(collectionMetadata).length > 0 ? collectionMetadata : null,
        status: "active",
      })
      .returning();

    return NextResponse.json({
      success: true,
      collection: {
        id: collection.id,
        address: collection.contractAddress,
        name: collection.name,
        symbol: collection.symbol,
        contractType: collection.contractType,
        chainId: collection.chain,
        salesMethod: collection.metadata && typeof collection.metadata === 'object' && 'salesMethod' in collection.metadata 
          ? (collection.metadata as any).salesMethod 
          : null,
        createdAt: collection.deployedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create collection" },
      { status: 500 }
    );
  }
}

