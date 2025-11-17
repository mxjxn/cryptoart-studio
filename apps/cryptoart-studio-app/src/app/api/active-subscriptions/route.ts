import { NextRequest, NextResponse } from 'next/server';

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

    // Fetch directly from Neynar API (no caching - focusing on basics)
    console.log(`Fetching subscriptions for FID ${fid} from Neynar API`);
    
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

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Neynar API error details:', errorText);
      throw new Error(`Neynar API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const subscriptions = data.subscriptions_created || [];

    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error('Failed to fetch active subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions. Please check your credentials and try again.' },
      { status: 500 }
    );
  }
}
