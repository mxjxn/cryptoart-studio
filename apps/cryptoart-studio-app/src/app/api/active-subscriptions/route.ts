import { NextRequest, NextResponse } from 'next/server';
import { hypersubCache } from '@cryptoart/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

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

    // Try to get from cache first
    const cachedSubscriptions = await hypersubCache.getSubscriptions(fidNumber);
    
    if (cachedSubscriptions) {
      console.log(`Returning cached subscriptions for FID ${fid} (${cachedSubscriptions.length} subscriptions)`);
      return NextResponse.json({ subscriptions: cachedSubscriptions });
    }

    // Cache miss - fetch from Neynar API
    console.log(`Cache miss for FID ${fid}, fetching from Neynar API`);
    
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Neynar API key is not configured' },
        { status: 500 }
      );
    }

    // Fetch user's created subscriptions using Neynar REST API
    const url = `https://api.neynar.com/v2/farcaster/user/subscriptions_created?fid=${fid}&subscription_provider=fabric_stp`;
    const options = {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    };

    console.log('Making request to:', url);
    console.log('With headers:', options.headers);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Neynar API error details:', errorText);
      throw new Error(`Neynar API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const subscriptions = data.subscriptions_created || [];

    // Cache the fresh data
    if (subscriptions.length > 0) {
      try {
        await hypersubCache.setSubscriptions(fidNumber, subscriptions);
        console.log(`Cached ${subscriptions.length} subscriptions for FID ${fid}`);
      } catch (cacheError) {
        console.error('Failed to cache subscriptions:', cacheError);
        // Don't fail the request if caching fails
      }
    }

    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error('Failed to fetch active subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions. Please check your credentials and try again.' },
      { status: 500 }
    );
  }
}
