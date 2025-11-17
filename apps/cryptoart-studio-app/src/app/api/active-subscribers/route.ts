import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const contractAddress = searchParams.get('contractAddress');
    
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
    console.log(`Fetching subscribers for FID ${fid}${contractAddress ? `, contract ${contractAddress}` : ''} from Neynar API`);

    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Neynar API key is not configured' },
        { status: 500 }
      );
    }

    // Fetch subscribers for a specific user using Neynar REST API
    const url = `https://api.neynar.com/v2/farcaster/user/subscribers?fid=${fid}&subscription_provider=fabric_stp`;
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
    
    // Filter subscribers by contract address if provided
    let filteredSubscribers = data.subscribers || [];
    if (contractAddress) {
      const beforeFilter = filteredSubscribers.length;
      filteredSubscribers = filteredSubscribers.filter((subscriber: any) => 
        subscriber.subscribed_to?.some((sub: any) => sub.contract_address === contractAddress)
      );
      console.log(`Filtered from ${beforeFilter} to ${filteredSubscribers.length} subscribers`);
    }

    return NextResponse.json({ subscribers: filteredSubscribers });
  } catch (error) {
    console.error('Failed to fetch active subscribers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscribers. Please check the FID and try again.' },
      { status: 500 }
    );
  }
}
