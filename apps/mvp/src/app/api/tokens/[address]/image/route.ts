import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, tokenImageCache, eq, and, gt } from '@cryptoart/db';
import { isAddress, type Address } from 'viem';

/**
 * GET /api/tokens/[address]/image
 * 
 * Returns a cached ERC20 token image URL.
 * 
 * This endpoint:
 * 1. Checks if token image is cached in database
 * 2. If not cached or expired, fetches from CoinGecko API
 * 3. Caches the result for 30 days
 * 4. Returns the image URL
 * 
 * Response:
 * {
 *   imageUrl: string,
 *   cached: boolean
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    
    if (!address || !isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid token address' },
        { status: 400 }
      );
    }

    const tokenAddress = address.toLowerCase() as Address;
    const db = getDatabase();
    const now = new Date();

    // Check cache first
    const cached = await db
      .select()
      .from(tokenImageCache)
      .where(
        and(
          eq(tokenImageCache.tokenAddress, tokenAddress),
          gt(tokenImageCache.expiresAt, now)
        )
      )
      .limit(1);

    if (cached.length > 0 && cached[0].imageUrl) {
      return NextResponse.json({
        imageUrl: cached[0].imageUrl,
        cached: true,
      }, {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=2592000', // 1 day browser, 30 days CDN
        },
      });
    }

    // Fetch from CoinGecko API
    // First, get the token ID from CoinGecko's token list
    let imageUrl: string | null = null;

    try {
      // Try CoinGecko API - Base chain ID is 8453
      const coingeckoResponse = await fetch(
        `https://api.coingecko.com/api/v3/coins/base/contract/${tokenAddress}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (coingeckoResponse.ok) {
        const data = await coingeckoResponse.json();
        if (data.image?.small || data.image?.thumb) {
          imageUrl = data.image.small || data.image.thumb;
        }
      }
    } catch (error) {
      console.error(`[Token Image] Error fetching from CoinGecko for ${tokenAddress}:`, error);
    }

    // If CoinGecko doesn't have it, try alternative sources
    if (!imageUrl) {
      // Try Trust Wallet token list
      try {
        const trustWalletResponse = await fetch(
          `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${tokenAddress}/logo.png`,
          { method: 'HEAD' }
        );
        if (trustWalletResponse.ok) {
          imageUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${tokenAddress}/logo.png`;
        }
      } catch (error) {
        // Ignore
      }
    }

    // Cache the result (even if null, to avoid repeated API calls)
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    if (cached.length > 0) {
      // Update existing cache
      await db
        .update(tokenImageCache)
        .set({
          imageUrl,
          expiresAt,
          updatedAt: now,
        })
        .where(eq(tokenImageCache.tokenAddress, tokenAddress));
    } else {
      // Insert new cache entry
      await db.insert(tokenImageCache).values({
        tokenAddress,
        imageUrl,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Token image not found', imageUrl: null },
        { status: 404 }
      );
    }

    return NextResponse.json({
      imageUrl,
      cached: false,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000',
      },
    });
  } catch (error) {
    console.error('[Token Image API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch token image',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

