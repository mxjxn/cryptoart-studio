import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, patronships, userProfiles, reputationScores } from '@repo/db';
import { desc, eq, sql } from 'drizzle-orm';

/**
 * GET /api/social/creator/[fid]/patrons
 * Returns top patrons for a specific creator
 *
 * Query params:
 * - limit: number of patrons to return (default: 50, max: 200)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { fid: string } }
) {
  try {
    const creatorFid = parseInt(params.fid, 10);

    if (isNaN(creatorFid)) {
      return NextResponse.json(
        { error: 'Invalid creator FID' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const db = getDatabase();

    // Get creator's profile
    const [creatorProfile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.fid, creatorFid))
      .limit(1);

    // Get all patrons for this creator
    const creatorPatrons = await db
      .select({
        collectorFid: patronships.collectorFid,
        totalSpent: patronships.totalSpent,
        itemsOwned: patronships.itemsOwned,
        marketPurchases: patronships.marketPurchases,
        galleryPurchases: patronships.galleryPurchases,
        firstPurchase: patronships.firstPurchase,
        lastPurchase: patronships.lastPurchase,
        patronTier: patronships.patronTier,
        isTopPatron: patronships.isTopPatron,
      })
      .from(patronships)
      .where(eq(patronships.creatorFid, creatorFid))
      .orderBy(desc(patronships.totalSpent))
      .limit(limit);

    if (creatorPatrons.length === 0) {
      return NextResponse.json({
        creator: creatorProfile ? {
          fid: creatorFid,
          username: creatorProfile.username,
          displayName: creatorProfile.displayName,
          avatar: creatorProfile.avatar,
        } : { fid: creatorFid },
        patrons: [],
        summary: {
          totalPatrons: 0,
          totalRevenue: '0',
          marketRevenue: '0',
          galleryRevenue: '0',
        },
      });
    }

    // Get FIDs to fetch profiles
    const fids = creatorPatrons.map(p => p.collectorFid);

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

    // Enrich patron data
    const enrichedPatrons = creatorPatrons.map((patron, index) => {
      const profile = profileMap.get(patron.collectorFid);
      const score = scoresMap.get(patron.collectorFid);

      return {
        rank: index + 1,
        fid: patron.collectorFid,
        username: profile?.username,
        displayName: profile?.displayName,
        avatar: profile?.avatar,

        relationship: {
          totalSpent: patron.totalSpent,
          itemsOwned: patron.itemsOwned,
          marketPurchases: patron.marketPurchases,
          galleryPurchases: patron.galleryPurchases,
          firstPurchase: patron.firstPurchase,
          lastPurchase: patron.lastPurchase,
          daysSinceFirstPurchase: Math.floor(
            (new Date().getTime() - new Date(patron.firstPurchase).getTime()) /
              (1000 * 60 * 60 * 24)
          ),
        },

        patronTier: patron.patronTier,
        isTopPatron: patron.isTopPatron,

        reputation: {
          collectorScore: score?.collectorScore || 0,
          badges: score?.badges || [],
        },
      };
    });

    // Calculate summary statistics
    const totalRevenue = creatorPatrons.reduce(
      (sum, p) => sum + BigInt(p.totalSpent),
      BigInt(0)
    );

    // We don't have individual market/gallery revenue tracked at patron level yet
    // This would require summing from actual purchase records
    // For now, we'll estimate based on purchase counts
    const totalMarketPurchases = creatorPatrons.reduce(
      (sum, p) => sum + p.marketPurchases,
      0
    );
    const totalGalleryPurchases = creatorPatrons.reduce(
      (sum, p) => sum + p.galleryPurchases,
      0
    );

    return NextResponse.json({
      creator: creatorProfile ? {
        fid: creatorFid,
        username: creatorProfile.username,
        displayName: creatorProfile.displayName,
        avatar: creatorProfile.avatar,
      } : { fid: creatorFid },

      patrons: enrichedPatrons,

      summary: {
        totalPatrons: creatorPatrons.length,
        totalRevenue: totalRevenue.toString(),
        marketPurchases: totalMarketPurchases,
        galleryPurchases: totalGalleryPurchases,
        topPatronTier: creatorPatrons[0]?.patronTier || 'none',
      },
    });
  } catch (error) {
    console.error('Failed to fetch creator patrons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch creator patrons. Please try again.' },
      { status: 500 }
    );
  }
}
