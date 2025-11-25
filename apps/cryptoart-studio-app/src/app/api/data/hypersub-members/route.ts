import { NextRequest, NextResponse } from 'next/server';
import { validateMembershipMiddleware } from '~/lib/auth';
import { getNeynarClient } from '~/lib/neynar';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fids = searchParams.get('fids');
    const contractAddress = searchParams.get('contractAddress');

    if (!fids) {
      return NextResponse.json(
        { error: 'FIDs parameter is required' },
        { status: 400 }
      );
    }

    if (!contractAddress) {
      return NextResponse.json(
        { error: 'contractAddress parameter is required' },
        { status: 400 }
      );
    }

    const fidNumbers = fids.split(',').map(fid => parseInt(fid.trim(), 10));
    if (fidNumbers.some(fid => isNaN(fid))) {
      return NextResponse.json(
        { error: 'Invalid FIDs parameter' },
        { status: 400 }
      );
    }

    // Validate CryptoArt membership for the first FID
    const membershipValidation = await validateMembershipMiddleware(fidNumbers[0]);
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

    // Get user data for all FIDs
    const usersResponse = await client.fetchBulkUsers({ fids: fidNumbers });
    const users = usersResponse.users;

    // Check Hypersub membership for each user
    const members = [];
    for (const user of users) {
      try {
        // Fetch user's subscriptions
        const url = `https://api.neynar.com/v2/farcaster/user/subscribers?fid=${user.fid}&subscription_provider=fabric_stp`;
        const response = await fetch(url, {
          headers: {
            'x-api-key': process.env.NEYNAR_API_KEY!,
          },
        });

        if (!response.ok) {
          console.error(`Failed to fetch subscriptions for FID ${user.fid}:`, response.statusText);
          continue;
        }

        const data = await response.json();
        const subscriptions = data.subscribers || [];

        // Check if user has active subscription to the specified contract
        const activeSubscription = subscriptions.find((sub: any) => {
          const subscription = sub.subscribed_to?.[0];
          if (!subscription) return false;
          
          const isTargetContract = subscription.contract_address === contractAddress;
          const isActive = new Date(subscription.expires_at) > new Date();
          
          return isTargetContract && isActive;
        });

        if (activeSubscription) {
          const subscription = activeSubscription.subscribed_to[0];
          members.push({
            fid: user.fid,
            username: user.username,
            displayName: user.display_name,
            walletAddress: user.verified_addresses?.primary?.eth_address,
            pfpUrl: user.pfp_url,
            subscription: {
              contractAddress: subscription.contract_address,
              subscribedAt: subscription.subscribed_at,
              expiresAt: subscription.expires_at,
              isActive: new Date(subscription.expires_at) > new Date(),
            },
          });
        }
      } catch (error) {
        console.error(`Error checking Hypersub membership for FID ${user.fid}:`, error);
        // Continue with other users
      }
    }

    return NextResponse.json({
      contractAddress,
      members,
      totalMembers: members.length,
      activeMembers: members.filter(m => m.subscription.isActive).length,
    });
  } catch (error) {
    console.error('Failed to fetch Hypersub members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Hypersub members. Please try again.' },
      { status: 500 }
    );
  }
}
