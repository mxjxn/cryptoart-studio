import { NextRequest, NextResponse } from 'next/server';
import { validateMembershipMiddleware } from '~/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get('contractAddress');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;
    const sortBy = searchParams.get('sortBy') || 'subscribed_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const searchTerm = searchParams.get('search');

    if (!contractAddress) {
      return NextResponse.json(
        { error: 'contractAddress parameter is required' },
        { status: 400 }
      );
    }

    // Get FID from headers for membership validation
    const fid = request.headers.get('x-farcaster-fid');
    if (!fid) {
      return NextResponse.json({ error: 'FID header missing' }, { status: 401 });
    }

    const fidNum = parseInt(fid, 10);
    if (isNaN(fidNum)) {
      return NextResponse.json({ error: 'Invalid FID header' }, { status: 400 });
    }

    // Validate CryptoArt membership
    const membershipValidation = await validateMembershipMiddleware(fidNum);
    if (!membershipValidation.valid) {
      return NextResponse.json(
        { error: membershipValidation.error },
        { status: 403 }
      );
    }

    // Fetch subscribers from Neynar API
    const url = `https://api.neynar.com/v2/farcaster/user/subscribers?fid=${fidNum}&subscription_provider=fabric_stp&limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': process.env.NEYNAR_API_KEY!,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch subscribers:', response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch subscribers' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const subscribers = data.subscribers || [];

    // Filter subscribers by contract address and active status
    const filteredSubscribers = subscribers
      .filter((sub: any) => {
        const subscription = sub.subscribed_to?.[0];
        if (!subscription) return false;
        
        const isTargetContract = subscription.contract_address === contractAddress;
        const isActive = new Date(subscription.expires_at) > new Date();
        
        return isTargetContract && isActive;
      })
      .map((sub: any) => {
        const subscription = sub.subscribed_to[0];
        const user = sub.user;
        
        return {
          fid: user.fid,
          username: user.username,
          displayName: user.display_name,
          walletAddress: user.verified_addresses?.primary?.eth_address,
          pfpUrl: user.pfp_url,
          followerCount: user.follower_count,
          followingCount: user.following_count,
          powerBadge: user.power_badge,
          score: user.score,
          subscription: {
            contractAddress: subscription.contract_address,
            subscribedAt: subscription.subscribed_at,
            expiresAt: subscription.expires_at,
            isActive: new Date(subscription.expires_at) > new Date(),
            daysRemaining: Math.ceil((new Date(subscription.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
          },
        };
      });

    // Apply search filter if provided
    let searchFilteredSubscribers = filteredSubscribers;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      searchFilteredSubscribers = filteredSubscribers.filter((sub: any) =>
        sub.username.toLowerCase().includes(searchLower) ||
        sub.displayName.toLowerCase().includes(searchLower) ||
        sub.walletAddress?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    searchFilteredSubscribers.sort((a: any, b: any) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'subscription') {
        aValue = a.subscription.subscribedAt;
        bValue = b.subscription.subscribedAt;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const paginatedSubscribers = searchFilteredSubscribers.slice(offset, offset + limit);

    return NextResponse.json({
      subscribers: paginatedSubscribers,
      totalSubscribers: searchFilteredSubscribers.length,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < searchFilteredSubscribers.length,
      },
      contractAddress,
    });
  } catch (error) {
    console.error('Failed to fetch subscribers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscribers. Please try again.' },
      { status: 500 }
    );
  }
}

