import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, marketSwapsCache, patronships, reputationScores, userProfiles, creatorCoreContracts } from '@repo/db';
import { eq, sql, and } from 'drizzle-orm';

/**
 * POST /api/social/track-swap
 * Tracks LSSVM pool swaps from such.market
 *
 * This endpoint is called by such.market after a successful swap to:
 * 1. Cache the swap data
 * 2. Update trader reputation
 * 3. Update patronship relationships (if NFT has a known creator)
 *
 * Body:
 * {
 *   txHash: string
 *   poolAddress: string
 *   poolType: 'LINEAR' | 'EXPONENTIAL' | 'XYK' | 'GDA'
 *   nftContract: string
 *   tokenIds: string[]
 *   trader: { address: string, fid?: number }
 *   isBuy: boolean
 *   ethAmount: string
 *   spotPrice: string
 *   poolFee?: string
 *   protocolFee?: string
 *   timestamp: number
 *   blockNumber: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization (API key or similar)
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.SOCIAL_API_KEY;

    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      txHash,
      poolAddress,
      poolType,
      nftContract,
      tokenIds,
      trader,
      isBuy,
      ethAmount,
      spotPrice,
      poolFee,
      protocolFee,
      timestamp,
      blockNumber,
    } = body;

    // Validation
    if (!txHash || !poolAddress || !nftContract || !tokenIds || !trader?.address) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Check if swap already tracked
    const [existing] = await db
      .select()
      .from(marketSwapsCache)
      .where(eq(marketSwapsCache.txHash, txHash.toLowerCase()))
      .limit(1);

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Swap already tracked',
        cached: false,
      });
    }

    // Get or create trader profile if FID provided
    let traderFid = trader.fid;
    if (!traderFid) {
      // Try to find FID by address
      const [profile] = await db
        .select()
        .from(userProfiles)
        .where(
          sql`${userProfiles.verifiedAddresses}::jsonb @> ${JSON.stringify([trader.address.toLowerCase()])}`
        )
        .limit(1);

      traderFid = profile?.fid;
    }

    // Calculate cache expiration (30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Insert swap into cache
    await db.insert(marketSwapsCache).values({
      txHash: txHash.toLowerCase(),
      poolAddress: poolAddress.toLowerCase(),
      poolType: poolType || 'LINEAR',
      nftContract: nftContract.toLowerCase(),
      tokenIds: tokenIds,
      trader: trader.address.toLowerCase(),
      traderFid: traderFid || null,
      isBuy,
      ethAmount: ethAmount.toString(),
      nftAmount: tokenIds.length,
      spotPrice: spotPrice.toString(),
      poolFee: poolFee?.toString() || null,
      protocolFee: protocolFee?.toString() || null,
      timestamp: new Date(timestamp * 1000),
      blockNumber,
      expiresAt,
    });

    // Update trader reputation if FID is known
    if (traderFid) {
      await updateTraderReputation(db, traderFid, ethAmount);
    }

    // If this is a buy (trader bought NFT), check for creator and update patronship
    if (isBuy && traderFid) {
      await updatePatronshipFromSwap(
        db,
        traderFid,
        trader.address.toLowerCase(),
        nftContract.toLowerCase(),
        tokenIds,
        ethAmount,
        timestamp
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Swap tracked successfully',
      cached: true,
      traderFid: traderFid || null,
    });
  } catch (error) {
    console.error('Failed to track swap:', error);
    return NextResponse.json(
      {
        error: 'Failed to track swap',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function to update trader reputation
async function updateTraderReputation(db: any, traderFid: number, ethAmount: string) {
  try {
    // Upsert reputation score
    await db
      .insert(reputationScores)
      .values({
        fid: traderFid,
        tradeVolume: ethAmount,
        traderScore: 1,
      })
      .onConflictDoUpdate({
        target: reputationScores.fid,
        set: {
          tradeVolume: sql`CAST(${reputationScores.tradeVolume} AS BIGINT) + ${BigInt(ethAmount)}`,
          traderScore: sql`${reputationScores.traderScore} + 1`,
          lastUpdated: new Date(),
        },
      });
  } catch (error) {
    console.error('Failed to update trader reputation:', error);
  }
}

// Helper function to update patronship from swap
async function updatePatronshipFromSwap(
  db: any,
  collectorFid: number,
  collectorAddress: string,
  nftContract: string,
  tokenIds: string[],
  ethAmount: string,
  timestamp: number
) {
  try {
    // Find creator of the NFT contract
    const [contract] = await db
      .select()
      .from(creatorCoreContracts)
      .where(eq(creatorCoreContracts.contractAddress, nftContract))
      .limit(1);

    if (!contract || !contract.creatorFid) {
      // Creator not found or not linked to FID, skip patronship update
      return;
    }

    const creatorFid = contract.creatorFid;
    const purchaseTime = new Date(timestamp * 1000);

    // Check if patronship exists
    const [existingPatronship] = await db
      .select()
      .from(patronships)
      .where(
        and(
          eq(patronships.collectorFid, collectorFid),
          eq(patronships.creatorFid, creatorFid)
        )
      )
      .limit(1);

    if (existingPatronship) {
      // Update existing patronship
      const newTotalSpent = BigInt(existingPatronship.totalSpent) + BigInt(ethAmount);
      const newItemsOwned = existingPatronship.itemsOwned + tokenIds.length;
      const newMarketPurchases = existingPatronship.marketPurchases + 1;

      // Determine patron tier based on total spent
      let patronTier: string;
      if (newTotalSpent >= BigInt('5000000000000000000')) { // >= 5 ETH
        patronTier = 'whale';
      } else if (newTotalSpent >= BigInt('1000000000000000000')) { // >= 1 ETH
        patronTier = 'patron';
      } else if (newTotalSpent >= BigInt('100000000000000000')) { // >= 0.1 ETH
        patronTier = 'collector';
      } else {
        patronTier = 'supporter';
      }

      await db
        .update(patronships)
        .set({
          lastPurchase: purchaseTime,
          totalSpent: newTotalSpent.toString(),
          itemsOwned: newItemsOwned,
          marketPurchases: newMarketPurchases,
          patronTier,
          updatedAt: new Date(),
        })
        .where(eq(patronships.id, existingPatronship.id));
    } else {
      // Create new patronship
      const patronTier = BigInt(ethAmount) >= BigInt('100000000000000000')
        ? 'collector'
        : 'supporter';

      await db.insert(patronships).values({
        collectorFid,
        creatorFid,
        firstPurchase: purchaseTime,
        lastPurchase: purchaseTime,
        totalSpent: ethAmount,
        itemsOwned: tokenIds.length,
        marketPurchases: 1,
        galleryPurchases: 0,
        patronTier,
        isTopPatron: false,
      });
    }

    // Update creator reputation
    await db
      .insert(reputationScores)
      .values({
        fid: creatorFid,
        creatorRevenue: ethAmount,
        creatorScore: 1,
        uniqueCollectors: 1,
      })
      .onConflictDoUpdate({
        target: reputationScores.fid,
        set: {
          creatorRevenue: sql`CAST(${reputationScores.creatorRevenue} AS BIGINT) + ${BigInt(ethAmount)}`,
          creatorScore: sql`${reputationScores.creatorScore} + 1`,
          lastUpdated: new Date(),
        },
      });

    // Update collector reputation
    await db
      .insert(reputationScores)
      .values({
        fid: collectorFid,
        totalSpent: ethAmount,
        itemsCollected: tokenIds.length,
        collectorScore: 1,
      })
      .onConflictDoUpdate({
        target: reputationScores.fid,
        set: {
          totalSpent: sql`CAST(${reputationScores.totalSpent} AS BIGINT) + ${BigInt(ethAmount)}`,
          itemsCollected: sql`${reputationScores.itemsCollected} + ${tokenIds.length}`,
          collectorScore: sql`${reputationScores.collectorScore} + 1`,
          lastUpdated: new Date(),
        },
      });
  } catch (error) {
    console.error('Failed to update patronship from swap:', error);
  }
}
