import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, auctionCompletionsCache, nftMetadataCache, userProfiles } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { request, gql } from 'graphql-request';

/**
 * GET /api/social/sync/auction-completions
 * Syncs recently completed auctions from the subgraph to PostgreSQL cache
 *
 * This endpoint should be called:
 * - Periodically via cron (e.g., every 5 minutes)
 * - On-demand when needed
 *
 * Query params:
 * - limit: number of auctions to sync (default: 50, max: 500)
 * - forceRefresh: boolean to force re-sync existing auctions
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization (cron secret or admin)
    const authHeader = request.headers.get('authorization');
    const isAuthorized =
      authHeader === `Bearer ${process.env.CRON_SECRET}` ||
      authHeader === `Bearer ${process.env.ADMIN_SECRET}`;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500);
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    const db = getDatabase();

    // TODO: Get the actual subgraph URL from env or config
    const subgraphUrl = process.env.AUCTIONHOUSE_SUBGRAPH_URL ||
      'https://api.studio.thegraph.com/query/YOUR_QUERY_ID/cryptoart-auctionhouse/version/latest';

    // Query for finalized auctions (listing type 1 = INDIVIDUAL_AUCTION)
    const query = gql`
      query GetCompletedAuctions($limit: Int!, $skip: Int!) {
        listings(
          first: $limit
          skip: $skip
          orderBy: updatedAt
          orderDirection: desc
          where: {
            listingType: 1
            status: "FINALIZED"
            hasBid: true
          }
        ) {
          id
          listingId
          seller
          tokenAddress
          tokenId
          initialAmount
          startTime
          endTime
          updatedAt
          referrerBPS
          bids(
            first: 1
            orderBy: amount
            orderDirection: desc
          ) {
            id
            bidder
            amount
            referrer
            timestamp
          }
          purchases {
            id
            buyer
            amount
            referrer
            timestamp
          }
        }
      }
    `;

    const data = await request(subgraphUrl, query, {
      limit,
      skip: 0,
    });

    const listings = (data as any).listings;

    if (!listings || listings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new completed auctions to sync',
        synced: 0,
      });
    }

    let syncedCount = 0;
    let skippedCount = 0;

    for (const listing of listings) {
      const listingId = listing.listingId;

      // Check if already cached (unless force refresh)
      if (!forceRefresh) {
        const [existing] = await db
          .select()
          .from(auctionCompletionsCache)
          .where(eq(auctionCompletionsCache.listingId, listingId))
          .limit(1);

        if (existing) {
          skippedCount++;
          continue;
        }
      }

      // Get the winning bid
      const winningBid = listing.bids[0];
      const purchase = listing.purchases[0];

      if (!winningBid && !purchase) {
        console.warn(`Listing ${listingId} has no bids or purchases, skipping`);
        skippedCount++;
        continue;
      }

      const winner = purchase?.buyer || winningBid?.bidder;
      const finalBid = purchase?.amount || winningBid?.amount;
      const bidCount = listing.bids?.length || 0;
      const referrer = purchase?.referrer || winningBid?.referrer;
      const completedAt = purchase?.timestamp || winningBid?.timestamp || listing.updatedAt;

      // Try to get NFT metadata from cache
      const [nftMetadata] = await db
        .select()
        .from(nftMetadataCache)
        .where(
          sql`${nftMetadataCache.contractAddress} = ${listing.tokenAddress.toLowerCase()}
              AND ${nftMetadataCache.tokenId} = ${listing.tokenId}`
        )
        .limit(1);

      // Try to get FIDs for winner and seller
      // This requires addresses to be in userProfiles.verifiedAddresses
      const [winnerProfile] = await db
        .select()
        .from(userProfiles)
        .where(
          sql`${userProfiles.verifiedAddresses}::jsonb @> ${JSON.stringify([winner.toLowerCase()])}`
        )
        .limit(1);

      const [sellerProfile] = await db
        .select()
        .from(userProfiles)
        .where(
          sql`${userProfiles.verifiedAddresses}::jsonb @> ${JSON.stringify([listing.seller.toLowerCase()])}`
        )
        .limit(1);

      const [referrerProfile] = referrer ? await db
        .select()
        .from(userProfiles)
        .where(
          sql`${userProfiles.verifiedAddresses}::jsonb @> ${JSON.stringify([referrer.toLowerCase()])}`
        )
        .limit(1) : [null];

      // Calculate curator earnings (referrer fee)
      const curatorEarnings = referrer && listing.referrerBPS
        ? (BigInt(finalBid) * BigInt(listing.referrerBPS) / BigInt(10000)).toString()
        : null;

      // Check if this is winner's first auction win
      const isFirstWin = winnerProfile ? await checkIfFirstWin(db, winnerProfile.fid, listingId) : false;

      // Check if this is a record price for this seller/creator
      const isRecordPrice = sellerProfile ? await checkIfRecordPrice(db, sellerProfile.fid, finalBid) : false;

      // Calculate cache expiration (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Upsert into cache
      await db
        .insert(auctionCompletionsCache)
        .values({
          listingId: listingId,

          // NFT details
          tokenContract: listing.tokenAddress.toLowerCase(),
          tokenId: listing.tokenId,
          nftMetadata: nftMetadata ? {
            name: nftMetadata.name,
            description: nftMetadata.description,
            image: nftMetadata.imageURI,
            animation_url: nftMetadata.animationURI,
            attributes: nftMetadata.attributes,
          } : null,

          // Auction details
          finalBid: finalBid,
          bidCount,
          startTime: new Date(Number(listing.startTime) * 1000),
          endTime: new Date(Number(listing.endTime) * 1000),
          completedAt: new Date(Number(completedAt) * 1000),

          // Participants
          seller: listing.seller.toLowerCase(),
          sellerFid: sellerProfile?.fid || null,
          winner: winner.toLowerCase(),
          winnerFid: winnerProfile?.fid || null,

          // Attribution
          referrer: referrer?.toLowerCase() || null,
          curatorFid: referrerProfile?.fid || null,
          curatorEarnings,

          // Social flags
          featured: false, // Can be set manually later
          isFirstWin,
          isRecordPrice,

          // Cache management
          expiresAt,
        })
        .onConflictDoUpdate({
          target: auctionCompletionsCache.listingId,
          set: {
            nftMetadata: nftMetadata ? {
              name: nftMetadata.name,
              description: nftMetadata.description,
              image: nftMetadata.imageURI,
              animation_url: nftMetadata.animationURI,
              attributes: nftMetadata.attributes,
            } : null,
            winnerFid: winnerProfile?.fid || null,
            sellerFid: sellerProfile?.fid || null,
            curatorFid: referrerProfile?.fid || null,
            isFirstWin,
            isRecordPrice,
            expiresAt,
          },
        });

      syncedCount++;
    }

    // Cleanup expired entries
    await db
      .delete(auctionCompletionsCache)
      .where(sql`${auctionCompletionsCache.expiresAt} < NOW()`);

    return NextResponse.json({
      success: true,
      message: 'Auction completions synced successfully',
      synced: syncedCount,
      skipped: skippedCount,
      total: listings.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to sync auction completions:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync auction completions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function to check if this is the winner's first auction win
async function checkIfFirstWin(db: any, winnerFid: number, currentListingId: string): Promise<boolean> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auctionCompletionsCache)
    .where(
      sql`${auctionCompletionsCache.winnerFid} = ${winnerFid}
          AND ${auctionCompletionsCache.listingId} != ${currentListingId}`
    );

  return Number(result?.count || 0) === 0;
}

// Helper function to check if this is a record price for the seller
async function checkIfRecordPrice(db: any, sellerFid: number, finalBid: string): Promise<boolean> {
  const [result] = await db
    .select({
      maxBid: sql<string>`MAX(CAST(${auctionCompletionsCache.finalBid} AS BIGINT))::text`,
    })
    .from(auctionCompletionsCache)
    .where(eq(auctionCompletionsCache.sellerFid, sellerFid));

  if (!result?.maxBid) return true; // First sale is always a record

  return BigInt(finalBid) > BigInt(result.maxBid);
}
