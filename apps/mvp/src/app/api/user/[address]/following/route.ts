import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, follows, userCache, eq, sql, inArray, desc } from '@cryptoart/db';

/**
 * GET /api/user/[address]/following
 * Get following count and list for a user address
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
      // Get list of following with user info
      const followingData = await db
        .select({
          followingAddress: follows.followingAddress,
          createdAt: follows.createdAt,
        })
        .from(follows)
        .where(eq(follows.followerAddress, normalizedAddress))
        .orderBy(desc(follows.createdAt));
      
      // Get user info for all following
      const followingAddresses = followingData.map(f => f.followingAddress);
      const users = followingAddresses.length > 0
        ? await db.select()
            .from(userCache)
            .where(inArray(userCache.ethAddress, followingAddresses))
        : [];
      
      // Create a map for quick lookup
      const userMap = new Map(users.map(u => [u.ethAddress.toLowerCase(), u]));
      
      // Combine follow data with user info
      const following = followingData.map(follow => {
        const user = userMap.get(follow.followingAddress.toLowerCase());
        return {
          address: follow.followingAddress,
          createdAt: follow.createdAt,
          username: user?.username || null,
          displayName: user?.displayName || null,
          pfpUrl: user?.pfpUrl || null,
          fid: user?.fid || null,
        };
      });
      
      return NextResponse.json({
        following,
        count: following.length,
      });
    } else {
      // Get count only
      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(follows)
        .where(eq(follows.followerAddress, normalizedAddress));
      
      const count = countResult[0]?.count || 0;
      
      return NextResponse.json({
        count,
      });
    }
  } catch (error) {
    console.error('[following API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch following' },
      { status: 500 }
    );
  }
}

