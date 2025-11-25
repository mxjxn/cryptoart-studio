import { NextRequest, NextResponse } from 'next/server';
import { getNeynarClient } from '~/lib/neynar';
import { validateMembershipMiddleware } from '~/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const channelId = searchParams.get('channelId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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

    // Build query parameters for channel activity
    const queryParams: any = {
      fid: fidNumber,
      limit: 100, // Start with smaller limit
    };

    // Note: fetchCastsForUser doesn't support channel filtering directly
    // We'll fetch all casts and filter by channel if needed
    const castsResponse = await client.fetchCastsForUser(queryParams);

    // Analyze the casts to get activity stats
    const casts = castsResponse.casts || [];
    
    // Filter casts by channel and date range if specified
    let filteredCasts = casts;
    
    if (channelId) {
      filteredCasts = filteredCasts.filter(cast => 
        cast.channel?.id === channelId || (cast.channel as any)?.parent_url?.includes(channelId)
      );
    }
    
    if (startDate) {
      const startTime = new Date(startDate).getTime();
      filteredCasts = filteredCasts.filter(cast => 
        new Date(cast.timestamp).getTime() >= startTime
      );
    }
    
    if (endDate) {
      const endTime = new Date(endDate).getTime();
      filteredCasts = filteredCasts.filter(cast => 
        new Date(cast.timestamp).getTime() <= endTime
      );
    }
    
    // Count different types of activity
    const activityStats = {
      totalCasts: filteredCasts.length,
      originalCasts: filteredCasts.filter(cast => !cast.parent_hash).length,
      replies: filteredCasts.filter(cast => cast.parent_hash).length,
      reactions: filteredCasts.reduce((sum, cast) => sum + ((cast.reactions as any)?.length || 0), 0),
      recasts: filteredCasts.reduce((sum, cast) => sum + ((cast as any).recasts?.length || 0), 0),
      likes: filteredCasts.reduce((sum, cast) => sum + ((cast.reactions as any)?.length || 0), 0),
    };

    // Get channel-specific stats if channelId is provided
    let channelStats = null;
    if (channelId) {
      const channelCasts = casts.filter(cast => 
        cast.channel?.id === channelId || 
        (cast.channel as any)?.parent_url?.includes(channelId)
      );
      
      channelStats = {
        channelId,
        castsInChannel: channelCasts.length,
        repliesInChannel: channelCasts.filter(cast => cast.parent_hash).length,
        originalCastsInChannel: channelCasts.filter(cast => !cast.parent_hash).length,
        avgReactionsPerCast: channelCasts.length > 0 
          ? channelCasts.reduce((sum, cast) => sum + ((cast.reactions as any)?.length || 0), 0) / channelCasts.length 
          : 0,
      };
    }

    return NextResponse.json({
      fid: fidNumber,
      timeframe: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      activityStats,
      channelStats,
      totalCastsAnalyzed: casts.length,
    });
  } catch (error) {
    console.error('Failed to fetch channel activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channel activity. Please try again.' },
      { status: 500 }
    );
  }
}
