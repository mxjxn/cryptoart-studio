import { NextRequest, NextResponse } from 'next/server';
import { validateMembershipMiddleware } from '~/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Required parameters
    const channelId = searchParams.get('channelId');
    
    // Optional parameters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const searchText = searchParams.get('searchText');
    const authorFids = searchParams.get('authorFids');
    const hasLinks = searchParams.get('hasLinks');
    const hasImages = searchParams.get('hasImages');
    const hasEmbeds = searchParams.get('hasEmbeds');
    const minLikes = searchParams.get('minLikes');
    const minRecasts = searchParams.get('minRecasts');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;
    const cursor = searchParams.get('cursor');
    const sortType = searchParams.get('sortType') || 'desc_chron';
    const mode = searchParams.get('mode') || 'literal';

    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId parameter is required' },
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

    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Neynar API key is not configured' },
        { status: 500 }
      );
    }

    // Build search query string with operators
    const queryParts: string[] = [];
    
    // Add text search (strip whitespace to handle '+' encoded as ' ')
    // Also handle cases where searchText might be '+' or other special characters
    console.log('Raw searchText:', JSON.stringify(searchText));
    const cleanSearchText = searchText?.trim();
    console.log('Cleaned searchText:', JSON.stringify(cleanSearchText));
    
    if (cleanSearchText && cleanSearchText.length > 0 && cleanSearchText !== '+') {
      queryParts.push(cleanSearchText);
    }
    
    // Add date filters using before: and after: operators
    if (startDate) {
      queryParts.push(`after:${startDate}`);
    }
    if (endDate) {
      queryParts.push(`before:${endDate}`);
    }
    
    // If no search text provided but we have date filters, we need a base term
    // The API requires actual search terms, not just operators
    if (queryParts.length === 0) {
      queryParts.push('*'); // Use wildcard as base term
    } else if (!cleanSearchText || cleanSearchText === '+') {
      // If we only have date operators, prepend a wildcard
      queryParts.unshift('*');
    }
    
    // Join and trim the final query
    let queryString = queryParts.join(' ').trim();
    
    // Ensure we have a non-empty query string
    if (!queryString || queryString.length === 0) {
      queryString = '*';
    }
    
    console.log('Query parts:', queryParts);
    console.log('Final query string:', JSON.stringify(queryString));

    // Build search parameters for Neynar API
    const apiParams = new URLSearchParams();
    apiParams.append('q', queryString);
    apiParams.append('channel_id', channelId);
    apiParams.append('limit', Math.min(limit, 100).toString());
    apiParams.append('viewer_fid', fidNum.toString()); // For viewer context
    apiParams.append('sort_type', sortType);
    apiParams.append('mode', mode);
    
    if (authorFids) {
      // Note: search endpoint only supports single author_fid, we'll filter after
      const fidList = authorFids.split(',').map(fid => parseInt(fid.trim()));
      if (fidList.length === 1) {
        apiParams.append('author_fid', fidList[0].toString());
      }
    }
    
    if (cursor) apiParams.append('cursor', cursor);

    // Fetch channel casts using Neynar API search endpoint
    const url = `https://api.neynar.com/v2/farcaster/cast/search?${apiParams.toString()}`;
    console.log('Search URL:', url);
    console.log('Search parameters:', Object.fromEntries(apiParams.entries()));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Neynar API error details:', errorText);
      return NextResponse.json(
        { error: 'Failed to search channel casts. Please try again.' },
        { status: 500 }
      );
    }

    const data = await response.json();
    console.log('Raw API response:', JSON.stringify(data, null, 2));
    
    // Handle search response structure
    let casts = data.result?.casts || [];
    console.log(`Found ${casts.length} casts from channel search`);

    // Apply additional filters if specified
    // Note: searchText and date filters are now handled by the API query string
    
    if (authorFids) {
      const fidList = authorFids.split(',').map(fid => parseInt(fid.trim()));
      // Only filter if multiple FIDs provided (single FID already filtered by API)
      if (fidList.length > 1) {
        const beforeFilter = casts.length;
        casts = casts.filter((cast: any) => 
          fidList.includes(cast.author?.fid)
        );
        console.log(`Filtered from ${beforeFilter} to ${casts.length} casts for author FIDs: ${authorFids}`);
      }
    }

    if (hasLinks === 'true') {
      const beforeFilter = casts.length;
      casts = casts.filter((cast: any) => 
        cast.embeds?.some((embed: any) => embed.url)
      );
      console.log(`Filtered from ${beforeFilter} to ${casts.length} casts with links`);
    }

    if (hasImages === 'true') {
      const beforeFilter = casts.length;
      casts = casts.filter((cast: any) => 
        cast.embeds?.some((embed: any) => embed.type === 'image')
      );
      console.log(`Filtered from ${beforeFilter} to ${casts.length} casts with images`);
    }

    if (minLikes) {
      const minLikesNum = parseInt(minLikes);
      const beforeFilter = casts.length;
      casts = casts.filter((cast: any) => 
        (cast.reactions?.likes_count || 0) >= minLikesNum
      );
      console.log(`Filtered from ${beforeFilter} to ${casts.length} casts with min ${minLikesNum} likes`);
    }

    if (minRecasts) {
      const minRecastsNum = parseInt(minRecasts);
      const beforeFilter = casts.length;
      casts = casts.filter((cast: any) => 
        (cast.reactions?.recasts_count || 0) >= minRecastsNum
      );
      console.log(`Filtered from ${beforeFilter} to ${casts.length} casts with min ${minRecastsNum} recasts`);
    }

    // Date filtering is now handled by the API query string with before:/after: operators

    // Calculate activity stats
    const activityStats = {
      totalCasts: casts.length,
      originalCasts: casts.filter((cast: any) => !cast.parent_hash).length,
      replies: casts.filter((cast: any) => cast.parent_hash).length,
      totalLikes: casts.reduce((sum: number, cast: any) => sum + (cast.reactions?.likes?.length || 0), 0),
      totalRecasts: casts.reduce((sum: number, cast: any) => sum + (cast.reactions?.recasts?.length || 0), 0),
      totalReplies: casts.reduce((sum: number, cast: any) => sum + (cast.replies?.count || 0), 0),
      uniqueAuthors: new Set(casts.map((cast: any) => cast.author?.fid)).size,
      castsWithLinks: casts.filter((cast: any) => cast.embeds?.some((embed: any) => embed.url)).length,
      castsWithImages: casts.filter((cast: any) => cast.embeds?.some((embed: any) => embed.type === 'image')).length,
      castsWithEmbeds: casts.filter((cast: any) => cast.embeds && cast.embeds.length > 0).length,
    };

    // Calculate top active users
    const authorStats = new Map();
    casts.forEach((cast: any) => {
      const fid = cast.author?.fid;
      if (!fid) return;
      
      if (!authorStats.has(fid)) {
        authorStats.set(fid, {
          fid,
          username: cast.author?.username,
          displayName: cast.author?.display_name,
          pfpUrl: cast.author?.pfp_url,
          followerCount: cast.author?.follower_count,
          powerBadge: cast.author?.power_badge,
          score: cast.author?.score,
          activity: {
            totalCasts: 0,
            originalCasts: 0,
            replies: 0,
            totalLikes: 0,
            totalRecasts: 0,
            totalReplies: 0,
          },
        });
      }
      
      const stats = authorStats.get(fid);
      stats.activity.totalCasts++;
      if (!cast.parent_hash) stats.activity.originalCasts++;
      else stats.activity.replies++;
      stats.activity.totalLikes += cast.reactions?.likes?.length || 0;
      stats.activity.totalRecasts += cast.reactions?.recasts?.length || 0;
      stats.activity.totalReplies += cast.replies?.count || 0;
    });

    const topActiveUsers = Array.from(authorStats.values())
      .sort((a, b) => b.activity.totalCasts - a.activity.totalCasts)
      .slice(0, 10);

    // Transform casts for response
    const transformedCasts = casts.map((cast: any) => ({
      hash: cast.hash,
      text: cast.text,
      timestamp: cast.timestamp,
      author: {
        fid: cast.author?.fid,
        username: cast.author?.username,
        displayName: cast.author?.display_name,
        pfpUrl: cast.author?.pfp_url,
        followerCount: cast.author?.follower_count,
        powerBadge: cast.author?.power_badge,
        score: cast.author?.score,
      },
      reactions: {
        likesCount: cast.reactions?.likes?.length || 0,
        recastsCount: cast.reactions?.recasts?.length || 0,
      },
      replies: {
        count: cast.replies?.count || 0,
      },
      isReply: !!cast.parent_hash,
      channel: {
        id: cast.channel?.id,
        name: cast.channel?.name,
        url: cast.channel?.url,
      },
      embeds: cast.embeds?.map((embed: any) => ({
        url: embed.url,
        type: embed.type,
        isImage: embed.type === 'image',
        isLink: !!embed.url,
      })) || [],
      hasLinks: cast.embeds?.some((embed: any) => embed.url) || false,
      hasImages: cast.embeds?.some((embed: any) => embed.type === 'image') || false,
      hasEmbeds: !!(cast.embeds && cast.embeds.length > 0),
    }));

    return NextResponse.json({
      channelId,
      searchParams: {
        timeframe: {
          startDate,
          endDate,
        },
        searchText,
        hasLinks,
        hasImages,
        hasEmbeds,
        minLikes: minLikes ? parseInt(minLikes) : undefined,
        minRecasts: minRecasts ? parseInt(minRecasts) : undefined,
        authorFids: authorFids ? authorFids.split(',') : undefined,
      },
      activityStats,
      topActiveUsers,
      casts: transformedCasts,
      pagination: {
        next: data.result?.next,
        hasMore: !!data.result?.next,
      },
    });
  } catch (error) {
    console.error('Failed to search channel casts:', error);
    return NextResponse.json(
      { error: 'Failed to search channel casts. Please try again.' },
      { status: 500 }
    );
  }
}