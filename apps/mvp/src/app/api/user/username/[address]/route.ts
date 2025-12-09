import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getUserFromCache } from "~/lib/server/user-cache";
import { withTimeout } from "~/lib/utils";

// Set route timeout to 10 seconds
export const maxDuration = 10;

/**
 * Get username for an address
 * 
 * GET /api/user/username/[address]
 * 
 * Returns: { username: string | null }
 * 
 * Route-level caching: 5 minutes (prevents database pool exhaustion)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<{ username: string | null }>> {
  try {
    const { address } = await params;
    
    if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      return NextResponse.json(
        { username: null },
        { status: 400 }
      );
    }

    const normalizedAddress = address.toLowerCase();

    // Use unstable_cache to prevent database pool exhaustion
    // Wrap in timeout to prevent hanging if database is slow
    const user = await withTimeout(
      unstable_cache(
        async () => {
          return getUserFromCache(normalizedAddress);
        },
        ['user-username', normalizedAddress],
        {
          revalidate: 300, // Cache for 5 minutes
          tags: ['users', `user-${normalizedAddress}`], // Can be invalidated with revalidateTag
        }
      )(),
      5000, // 5 second timeout
      null // Fallback to null on timeout
    );
    
    if (user && user.username) {
      return NextResponse.json({ username: user.username });
    }

    return NextResponse.json({ username: null });
  } catch (error) {
    console.error('[username API] Error:', error);
    // Return null on error instead of crashing
    return NextResponse.json({ username: null });
  }
}




