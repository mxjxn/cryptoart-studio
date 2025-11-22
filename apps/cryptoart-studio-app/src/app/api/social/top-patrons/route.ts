import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, patronships, userProfiles, reputationScores } from '@repo/db';
import { desc, eq, sql, and } from 'drizzle-orm';

/**
 * GET /api/social/top-patrons
 * Returns top collectors/patrons ranked by total spend
 *
 * Query params:
 * - limit: number of patrons to return (default: 100, max: 500)
 * - offset: pagination offset (default: 0)
 * - period: time period filter - 'all', '30d', '7d' (default: 'all')
 * - minTier: minimum patron tier - 'supporter', 'collector', 'patron', 'whale'
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const period = searchParams.get('period') || 'all';
    const minTier = searchParams.get('minTier');

    const db = getDatabase();

    // Build time filter condition
    let timeCondition;
    if (period === '30d') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      timeCondition = sql`${patronships.lastPurchase} >= ${thirtyDaysAgo.toISOString()}`;
    } else if (period === '7d') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      timeCondition = sql`${patronships.lastPurchase} >= ${sevenDaysAgo.toISOString()}`;
    }

    // Build tier filter condition
    let tierCondition;
    if (minTier) {
      const tierOrder = { supporter: 1, collector: 2, patron: 3, whale: 4 };
      const minTierValue = tierOrder[minTier as keyof typeof tierOrder];
      if (minTierValue) {
        tierCondition = sql`CASE
          WHEN ${patronships.patronTier} = 'whale' THEN 4
          WHEN ${patronships.patronTier} = 'patron' THEN 3
          WHEN ${patronships.patronTier} = 'collector' THEN 2
          WHEN ${patronships.patronTier} = 'supporter' THEN 1
          ELSE 0
        END >= ${minTierValue}`;
      }
    }

    // Combine conditions
    const conditions = timeCondition && tierCondition
      ? and(timeCondition, tierCondition)
      : timeCondition || tierCondition;

    // Aggregate patronships by collector
    const topPatronsData = await db
      .select({
        collectorFid: patronships.collectorFid,
        totalSpent: sql<string>`SUM(CAST(${patronships.totalSpent} AS BIGINT))::text`,
        creatorsSupported: sql<number>`COUNT(DISTINCT ${patronships.creatorFid})`,
        itemsCollected: sql<number>`SUM(${patronships.itemsOwned})`,
        marketPurchases: sql<number>`SUM(${patronships.marketPurchases})`,
        galleryPurchases: sql<number>`SUM(${patronships.galleryPurchases})`,
        lastActivity: sql<Date>`MAX(${patronships.lastPurchase})`,
      })
      .from(patronships)
      .where(conditions)
      .groupBy(patronships.collectorFid)
      .orderBy(desc(sql`SUM(CAST(${patronships.totalSpent} AS BIGINT))`))
      .limit(limit)
      .offset(offset);

    // Get FIDs to fetch profiles and reputation
    const fids = topPatronsData.map(p => p.collectorFid);

    if (fids.length === 0) {
      return NextResponse.json({
        patrons: [],
        pagination: {
          total: 0,
          limit,
          offset,
          hasMore: false,
        },
      });
    }

    // Fetch user profiles
    const profiles = await db
      .select()
      .from(userProfiles)
      .where(sql`${userProfiles.fid} IN ${fids}`);

    const profileMap = new Map(profiles.map(p => [p.fid, p]));

    // Fetch reputation scores
    const scores = await db
      .select()
      .from(reputationScores)
      .where(sql`${reputationScores.fid} IN ${fids}`);

    const scoresMap = new Map(scores.map(s => [s.fid, s]));

    // Enrich patron data with profiles and scores
    const enrichedPatrons = topPatronsData.map((patron, index) => {
      const profile = profileMap.get(patron.collectorFid);
      const score = scoresMap.get(patron.collectorFid);

      // Determine patron tier based on total spent
      const totalSpentBigInt = BigInt(patron.totalSpent);
      let patronTier: string;
      if (totalSpentBigInt >= BigInt('5000000000000000000')) { // >= 5 ETH
        patronTier = 'whale';
      } else if (totalSpentBigInt >= BigInt('1000000000000000000')) { // >= 1 ETH
        patronTier = 'patron';
      } else if (totalSpentBigInt >= BigInt('100000000000000000')) { // >= 0.1 ETH
        patronTier = 'collector';
      } else {
        patronTier = 'supporter';
      }

      return {
        rank: offset + index + 1,
        fid: patron.collectorFid,
        username: profile?.username,
        displayName: profile?.displayName,
        avatar: profile?.avatar,

        stats: {
          totalSpent: patron.totalSpent,
          creatorsSupported: patron.creatorsSupported,
          itemsCollected: patron.itemsCollected,
          marketPurchases: patron.marketPurchases,
          galleryPurchases: patron.galleryPurchases,
          lastActivity: patron.lastActivity,
        },

        patronTier,

        reputation: {
          collectorScore: score?.collectorScore || 0,
          overallRank: score?.overallRank,
          badges: score?.badges || [],
        },
      };
    });

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${patronships.collectorFid})` })
      .from(patronships)
      .where(conditions);

    return NextResponse.json({
      patrons: enrichedPatrons,
      pagination: {
        total: Number(count),
        limit,
        offset,
        hasMore: offset + limit < Number(count),
      },
      filters: {
        period,
        minTier: minTier || 'all',
      },
    });
  } catch (error) {
    console.error('Failed to fetch top patrons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top patrons. Please try again.' },
      { status: 500 }
    );
  }
}
