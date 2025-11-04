import { NextRequest, NextResponse } from 'next/server';
import { hypersubCache } from '@repo/cache';

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

    // Try to get from cache first (if contractAddress is provided)
    if (contractAddress) {
      const cachedSubscribers = await hypersubCache.getSubscribers(fidNumber, contractAddress);
      
      if (cachedSubscribers) {
        console.log(`Returning cached subscribers for FID ${fid}, contract ${contractAddress} (${cachedSubscribers.length} subscribers)`);
        return NextResponse.json({ subscribers: cachedSubscribers });
      }
    }

    // Cache miss - fetch from Neynar API
    console.log(`Cache miss for FID ${fid}${contractAddress ? `, contract ${contractAddress}` : ''}, fetching from Neynar API`);

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
    
    console.log('Raw API response - total subscribers:', data.subscribers?.length || 0);
    console.log('Contract address filter:', contractAddress);
    
    // Filter subscribers by contract address if provided
    let filteredSubscribers = data.subscribers || [];
    if (contractAddress) {
      const beforeFilter = filteredSubscribers.length;
      filteredSubscribers = filteredSubscribers.filter((subscriber: any) => 
        subscriber.subscribed_to?.some((sub: any) => sub.contract_address === contractAddress)
      );
      console.log(`Filtered from ${beforeFilter} to ${filteredSubscribers.length} subscribers`);
      
      // Log sample subscriber data structure for debugging
      if (filteredSubscribers.length > 0) {
        console.log('Sample filtered subscriber:', {
          fid: filteredSubscribers[0].user.fid,
          username: filteredSubscribers[0].user.username,
          subscribed_to: filteredSubscribers[0].subscribed_to
        });
      }

      // Cache the filtered data for this specific contract
      if (filteredSubscribers.length > 0) {
        try {
          await hypersubCache.setSubscribers(fidNumber, contractAddress, filteredSubscribers);
          console.log(`Cached ${filteredSubscribers.length} subscribers for FID ${fid}, contract ${contractAddress}`);
        } catch (cacheError) {
          console.error('Failed to cache subscribers:', cacheError);
          // Don't fail the request if caching fails
        }
      }
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
