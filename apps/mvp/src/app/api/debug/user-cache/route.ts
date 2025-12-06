import { NextRequest, NextResponse } from "next/server";
import { 
  getDatabase, 
  userCache, 
  eq,
  sql,
} from '@cryptoart/db';

/**
 * Debug endpoint to check user cache state
 * REMOVE IN PRODUCTION or add admin auth
 * 
 * Usage:
 * GET /api/debug/user-cache?username=mxjxn
 * GET /api/debug/user-cache?address=0x...
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const username = searchParams.get('username');
  const address = searchParams.get('address');
  
  if (!username && !address) {
    return NextResponse.json({
      error: "Provide ?username=xxx or ?address=0x...",
    }, { status: 400 });
  }
  
  try {
    const db = getDatabase();
    
    let results: any[] = [];
    let query = '';
    
    if (username) {
      // Case-insensitive search
      query = `lower(username) = '${username.toLowerCase()}'`;
      results = await db.select()
        .from(userCache)
        .where(sql`lower(${userCache.username}) = ${username.toLowerCase()}`)
        .limit(10);
    } else if (address) {
      // Address search (also check verifiedWallets)
      const normalizedAddress = address.toLowerCase();
      query = `ethAddress = '${normalizedAddress}' OR '${normalizedAddress}' in verifiedWallets`;
      
      // Primary address match
      const primaryMatch = await db.select()
        .from(userCache)
        .where(eq(userCache.ethAddress, normalizedAddress))
        .limit(1);
      
      // Verified wallet match
      const verifiedMatch = await db.select()
        .from(userCache)
        .where(sql`${userCache.verifiedWallets} @> ${JSON.stringify([normalizedAddress])}::jsonb`)
        .limit(1);
      
      results = [...primaryMatch, ...verifiedMatch].filter((v, i, a) => 
        a.findIndex(t => t.ethAddress === v.ethAddress) === i
      );
    }
    
    // Also get a sample of all cached users with usernames (for debugging)
    const sampleWithUsernames = await db.select()
      .from(userCache)
      .where(sql`${userCache.username} IS NOT NULL`)
      .limit(5);
    
    return NextResponse.json({
      searchedFor: { username, address },
      query,
      foundCount: results.length,
      results: results.map(r => ({
        ethAddress: r.ethAddress,
        username: r.username,
        displayName: r.displayName,
        fid: r.fid,
        source: r.source,
        cachedAt: r.cachedAt,
        expiresAt: r.expiresAt,
        verifiedWalletsCount: (r.verifiedWallets as string[] | null)?.length || 0,
        verifiedWallets: r.verifiedWallets,
      })),
      sampleUsersWithUsernames: sampleWithUsernames.map(r => ({
        ethAddress: r.ethAddress,
        username: r.username,
        fid: r.fid,
      })),
      envCheck: {
        hasNeynarApiKey: !!process.env.NEYNAR_API_KEY,
        hasPostgresUrl: !!(process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL),
      },
    });
  } catch (error) {
    console.error('[debug/user-cache] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}


