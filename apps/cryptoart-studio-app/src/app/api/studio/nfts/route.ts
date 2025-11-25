import { NextRequest, NextResponse } from "next/server";
import { getDatabase, collectionMints, nftCollections, eq } from "@repo/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionAddress = searchParams.get("collectionAddress");
    const collectionId = searchParams.get("collectionId");

    const db = getDatabase();
    const baseQuery = db.select().from(collectionMints);

    let mints;
    if (collectionId) {
      mints = await baseQuery.where(eq(collectionMints.collectionId, parseInt(collectionId)));
    } else if (collectionAddress) {
      // First find the collection by address
      const [collection] = await db
        .select()
        .from(nftCollections)
        .where(eq(nftCollections.contractAddress, collectionAddress.toLowerCase()))
        .limit(1);
      
      if (collection) {
        mints = await baseQuery.where(eq(collectionMints.collectionId, collection.id));
      } else {
        return NextResponse.json({
          success: true,
          mints: [],
        });
      }
    } else {
      mints = await baseQuery;
    }

    return NextResponse.json({
      success: true,
      mints: mints.map((m) => ({
        id: m.id,
        collectionId: m.collectionId,
        tokenId: m.tokenId,
        recipientAddress: m.recipientAddress,
        recipientFid: m.recipientFid,
        txHash: m.txHash,
        metadata: m.metadata,
        createdAt: m.mintedAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error("Error fetching mints:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch mints" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collectionId, collectionAddress, tokenId, recipientAddress, recipientFid, txHash, metadata } = body;

    if (!tokenId || !recipientAddress) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: tokenId, recipientAddress" },
        { status: 400 }
      );
    }

    const db = getDatabase();
    let finalCollectionId = collectionId;

    // If collectionAddress provided but not collectionId, find the collection
    if (!finalCollectionId && collectionAddress) {
      const [collection] = await db
        .select()
        .from(nftCollections)
        .where(eq(nftCollections.contractAddress, collectionAddress.toLowerCase()))
        .limit(1);
      
      if (!collection) {
        return NextResponse.json(
          { success: false, error: "Collection not found" },
          { status: 404 }
        );
      }
      finalCollectionId = collection.id;
    }

    if (!finalCollectionId) {
      return NextResponse.json(
        { success: false, error: "Missing collectionId or collectionAddress" },
        { status: 400 }
      );
    }

    const [mint] = await db
      .insert(collectionMints)
      .values({
        collectionId: finalCollectionId,
        tokenId: tokenId.toString(),
        recipientAddress: recipientAddress.toLowerCase(),
        recipientFid: recipientFid || null,
        txHash: txHash || null,
        metadata: metadata || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      mint: {
        id: mint.id,
        collectionId: mint.collectionId,
        tokenId: mint.tokenId,
        recipientAddress: mint.recipientAddress,
        recipientFid: mint.recipientFid,
        txHash: mint.txHash,
        metadata: mint.metadata,
        createdAt: mint.mintedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error creating mint:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create mint" },
      { status: 500 }
    );
  }
}

