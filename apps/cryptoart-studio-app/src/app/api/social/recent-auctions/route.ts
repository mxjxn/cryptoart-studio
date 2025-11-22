import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, auctionCompletionsCache, userProfiles } from '@repo/db';
import { desc, eq, sql } from 'drizzle-orm';

/**
 * GET /api/social/recent-auctions
 * Returns recently completed auctions with winner and NFT metadata
 *
 * Query params:
 * - limit: number of auctions to return (default: 50, max: 100)
 * - offset: pagination offset (default: 0)
 * - featured: boolean to filter featured auctions only
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const featuredOnly = searchParams.get('featured') === 'true';

    const db = getDatabase();

    // Build query conditions
    const conditions = featuredOnly
      ? eq(auctionCompletionsCache.featured, true)
      : undefined;

    // Query recent auction completions
    const auctions = await db
      .select({
        id: auctionCompletionsCache.id,
        listingId: auctionCompletionsCache.listingId,

        // NFT details
        tokenContract: auctionCompletionsCache.tokenContract,
        tokenId: auctionCompletionsCache.tokenId,
        nftMetadata: auctionCompletionsCache.nftMetadata,

        // Auction details
        finalBid: auctionCompletionsCache.finalBid,
        bidCount: auctionCompletionsCache.bidCount,
        startTime: auctionCompletionsCache.startTime,
        endTime: auctionCompletionsCache.endTime,
        completedAt: auctionCompletionsCache.completedAt,

        // Participants
        seller: auctionCompletionsCache.seller,
        sellerFid: auctionCompletionsCache.sellerFid,
        winner: auctionCompletionsCache.winner,
        winnerFid: auctionCompletionsCache.winnerFid,

        // Attribution
        referrer: auctionCompletionsCache.referrer,
        curatorFid: auctionCompletionsCache.curatorFid,
        curatorEarnings: auctionCompletionsCache.curatorEarnings,

        // Social flags
        featured: auctionCompletionsCache.featured,
        isFirstWin: auctionCompletionsCache.isFirstWin,
        isRecordPrice: auctionCompletionsCache.isRecordPrice,
      })
      .from(auctionCompletionsCache)
      .where(conditions)
      .orderBy(desc(auctionCompletionsCache.completedAt))
      .limit(limit)
      .offset(offset);

    // Get unique FIDs to fetch user profiles
    const fids = new Set<number>();
    auctions.forEach(auction => {
      if (auction.winnerFid) fids.add(auction.winnerFid);
      if (auction.sellerFid) fids.add(auction.sellerFid);
      if (auction.curatorFid) fids.add(auction.curatorFid);
    });

    // Fetch user profiles for all participants
    const profiles = fids.size > 0
      ? await db
          .select()
          .from(userProfiles)
          .where(sql`${userProfiles.fid} IN ${Array.from(fids)}`)
      : [];

    const profileMap = new Map(profiles.map(p => [p.fid, p]));

    // Enrich auctions with user profile data
    const enrichedAuctions = auctions.map(auction => {
      const winnerProfile = auction.winnerFid ? profileMap.get(auction.winnerFid) : null;
      const sellerProfile = auction.sellerFid ? profileMap.get(auction.sellerFid) : null;
      const curatorProfile = auction.curatorFid ? profileMap.get(auction.curatorFid) : null;

      return {
        listingId: auction.listingId,

        nft: {
          contract: auction.tokenContract,
          tokenId: auction.tokenId,
          metadata: auction.nftMetadata,
        },

        auction: {
          finalBid: auction.finalBid,
          bidCount: auction.bidCount,
          startTime: auction.startTime,
          endTime: auction.endTime,
          completedAt: auction.completedAt,
          duration: new Date(auction.endTime).getTime() - new Date(auction.startTime).getTime(),
        },

        winner: winnerProfile ? {
          fid: auction.winnerFid!,
          username: winnerProfile.username,
          displayName: winnerProfile.displayName,
          avatar: winnerProfile.avatar,
          address: auction.winner,
        } : {
          address: auction.winner,
        },

        seller: sellerProfile ? {
          fid: auction.sellerFid!,
          username: sellerProfile.username,
          displayName: sellerProfile.displayName,
          avatar: sellerProfile.avatar,
          address: auction.seller,
        } : {
          address: auction.seller,
        },

        curator: auction.curatorFid && curatorProfile ? {
          fid: auction.curatorFid,
          username: curatorProfile.username,
          displayName: curatorProfile.displayName,
          avatar: curatorProfile.avatar,
          earnings: auction.curatorEarnings,
        } : null,

        flags: {
          featured: auction.featured,
          isFirstWin: auction.isFirstWin,
          isRecordPrice: auction.isRecordPrice,
        },
      };
    });

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auctionCompletionsCache)
      .where(conditions);

    return NextResponse.json({
      auctions: enrichedAuctions,
      pagination: {
        total: Number(count),
        limit,
        offset,
        hasMore: offset + limit < Number(count),
      },
    });
  } catch (error) {
    console.error('Failed to fetch recent auctions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent auctions. Please try again.' },
      { status: 500 }
    );
  }
}
