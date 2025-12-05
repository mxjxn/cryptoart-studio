import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, follows, userCache, eq, sql, inArray, desc } from '@cryptoart/db';

/**
 * GET /api/user/[address]/followers
 * Get followers count and list for a user address
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(req.url);
    const listOnly = searchParams.get('list') === 'true';
    
    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    const normalizedAddress = address.toLowerCase();
    
    if (listOnly) {
      // Get list of followers with user info
      const followersData = await db
        .select({
          followerAddress: follows.followerAddress,
          createdAt: follows.createdAt,
        })
        .from(follows)
        .where(eq(follows.followingAddress, normalizedAddress))
        .orderBy(desc(follows.createdAt));
      
      // Get user info for all followers
      const followerAddresses = followersData.map(f => f.followerAddress);
      const users = followerAddresses.length > 0
        ? await db.select()
            .from(userCache)
            .where(inArray(userCache.ethAddress, followerAddresses))
        : [];
      
      // Create a map for quick lookup
      const userMap = new Map(users.map(u => [u.ethAddress.toLowerCase(), u]));
      
      // Combine follow data with user info
      const followers = followersData.map(follow => {
        const user = userMap.get(follow.followerAddress.toLowerCase());
        return {
          address: follow.followerAddress,
          createdAt: follow.createdAt,
          username: user?.username || null,
          displayName: user?.displayName || null,
          pfpUrl: user?.pfpUrl || null,
          fid: user?.fid || null,
        };
      });
      
      return NextResponse.json({
        followers,
        count: followers.length,
      });
    } else {
      // Get count only
      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(follows)
        .where(eq(follows.followingAddress, normalizedAddress));
      
      const count = countResult[0]?.count || 0;
      
      return NextResponse.json({
        count,
      });
    }
  } catch (error) {
    console.error('[followers API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch followers' },
      { status: 500 }
    );
  }
}

