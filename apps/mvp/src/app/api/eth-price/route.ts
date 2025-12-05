import { NextResponse } from 'next/server';

// Cache ETH price for 5 minutes
let cachedPrice: { usd: number; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/eth-price
 * Get current ETH price in USD (cached)
 */
export async function GET() {
  const now = Date.now();
  
  // Return cached price if still valid
  if (cachedPrice && now - cachedPrice.timestamp < CACHE_DURATION) {
    return NextResponse.json({ usd: cachedPrice.usd });
  }
  
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    const usd = data.ethereum?.usd;
    
    if (typeof usd !== 'number') {
      throw new Error('Invalid response from CoinGecko');
    }
    
    cachedPrice = { usd, timestamp: now };
    
    return NextResponse.json({ usd });
  } catch (error) {
    console.error('[ETH Price] Error fetching:', error);
    
    // Return cached price if available, even if stale
    if (cachedPrice) {
      return NextResponse.json({ usd: cachedPrice.usd, stale: true });
    }
    
    return NextResponse.json({ usd: null, error: 'Failed to fetch ETH price' });
  }
}

