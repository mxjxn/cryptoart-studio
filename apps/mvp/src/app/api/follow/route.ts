import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, follows, eq, and } from '@cryptoart/db';

/**
 * POST /api/follow
 * Follow a user
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { followerAddress, followingAddress } = body;
    
    if (!followerAddress || !followingAddress) {
      return NextResponse.json(
        { error: 'followerAddress and followingAddress are required' },
        { status: 400 }
      );
    }
    
    // Validate addresses
    if (!/^0x[a-fA-F0-9]{40}$/i.test(followerAddress) || !/^0x[a-fA-F0-9]{40}$/i.test(followingAddress)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }
    
    // Can't follow yourself
    if (followerAddress.toLowerCase() === followingAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Cannot follow yourself' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    const normalizedFollower = followerAddress.toLowerCase();
    const normalizedFollowing = followingAddress.toLowerCase();
    
    // Check if already following
    const existing = await db.select()
      .from(follows)
      .where(
        and(
          eq(follows.followerAddress, normalizedFollower),
          eq(follows.followingAddress, normalizedFollowing)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return NextResponse.json({ 
        success: true, 
        following: true,
        message: 'Already following' 
      });
    }
    
    // Create follow relationship
    const [result] = await db.insert(follows)
      .values({
        followerAddress: normalizedFollower,
        followingAddress: normalizedFollowing,
      })
      .returning();
    
    return NextResponse.json({ 
      success: true, 
      following: true,
      follow: result 
    });
  } catch (error) {
    console.error('[follow API] Error following user:', error);
    return NextResponse.json(
      { error: 'Failed to follow user' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/follow
 * Unfollow a user
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const followerAddress = searchParams.get('followerAddress');
    const followingAddress = searchParams.get('followingAddress');
    
    if (!followerAddress || !followingAddress) {
      return NextResponse.json(
        { error: 'followerAddress and followingAddress are required' },
        { status: 400 }
      );
    }
    
    // Validate addresses
    if (!/^0x[a-fA-F0-9]{40}$/i.test(followerAddress) || !/^0x[a-fA-F0-9]{40}$/i.test(followingAddress)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    const normalizedFollower = followerAddress.toLowerCase();
    const normalizedFollowing = followingAddress.toLowerCase();
    
    // Delete follow relationship
    const result = await db.delete(follows)
      .where(
        and(
          eq(follows.followerAddress, normalizedFollower),
          eq(follows.followingAddress, normalizedFollowing)
        )
      )
      .returning();
    
    return NextResponse.json({ 
      success: true, 
      following: false,
      message: 'Unfollowed successfully' 
    });
  } catch (error) {
    console.error('[follow API] Error unfollowing user:', error);
    return NextResponse.json(
      { error: 'Failed to unfollow user' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/follow
 * Check if user is following another user
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const followerAddress = searchParams.get('followerAddress');
    const followingAddress = searchParams.get('followingAddress');
    
    if (!followerAddress || !followingAddress) {
      return NextResponse.json(
        { error: 'followerAddress and followingAddress are required' },
        { status: 400 }
      );
    }
    
    // Validate addresses
    if (!/^0x[a-fA-F0-9]{40}$/i.test(followerAddress) || !/^0x[a-fA-F0-9]{40}$/i.test(followingAddress)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    const normalizedFollower = followerAddress.toLowerCase();
    const normalizedFollowing = followingAddress.toLowerCase();
    
    // Check if following
    const existing = await db.select()
      .from(follows)
      .where(
        and(
          eq(follows.followerAddress, normalizedFollower),
          eq(follows.followingAddress, normalizedFollowing)
        )
      )
      .limit(1);
    
    return NextResponse.json({ 
      following: existing.length > 0 
    });
  } catch (error) {
    console.error('[follow API] Error checking follow status:', error);
    return NextResponse.json(
      { error: 'Failed to check follow status' },
      { status: 500 }
    );
  }
}








