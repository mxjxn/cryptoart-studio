import { NextRequest, NextResponse } from 'next/server';
import { getNeynarClient } from '~/lib/neynar';
import { validateMembershipMiddleware } from '~/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const limit = parseInt(searchParams.get('limit') || '100');
    const cursor = searchParams.get('cursor');

    if (!fid) {
      return NextResponse.json(
        { error: 'FID parameter is required' },
        { status: 400 }
      );
    }

    const fidNumber = parseInt(fid, 10);
    if (isNaN(fidNumber)) {
      return NextResponse.json(
        { error: 'Invalid FID parameter' },
        { status: 400 }
      );
    }

    // Validate CryptoArt membership
    const membershipValidation = await validateMembershipMiddleware(fidNumber);
    if (!membershipValidation.valid) {
      return NextResponse.json(
        { error: membershipValidation.error },
        { status: 403 }
      );
    }

    const client = getNeynarClient();
    if (!client) {
      return NextResponse.json(
        { error: 'Neynar client not configured' },
        { status: 503 }
      );
    }
    
    // Fetch user's followers using Neynar API
    const followersResponse = await client.fetchUserFollowers({
      fid: fidNumber,
      limit: Math.min(limit, 1000), // Cap at 1000 per request
      cursor: cursor || undefined,
    });

    // Transform the response to include verified addresses
    const followers = followersResponse.users.map(user => ({
      fid: (user as any).fid,
      username: (user as any).username,
      displayName: (user as any).display_name,
      pfpUrl: (user as any).pfp_url,
      verifiedAddresses: (user as any).verified_addresses,
      followerCount: (user as any).follower_count,
      followingCount: (user as any).following_count,
      castCount: (user as any).cast_count,
    }));

    return NextResponse.json({
      followers,
      nextCursor: followersResponse.next?.cursor,
      totalFollowers: (followersResponse as any).total,
    });
  } catch (error) {
    console.error('Failed to fetch followers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch followers. Please try again.' },
      { status: 500 }
    );
  }
}
