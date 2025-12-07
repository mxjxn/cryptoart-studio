import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getUserFromCache } from "~/lib/server/user-cache";

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
  const { address } = await params;
  
  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.json(
      { username: null },
      { status: 400 }
    );
  }

  const normalizedAddress = address.toLowerCase();

  // Use unstable_cache to prevent database pool exhaustion
  const user = await unstable_cache(
    async () => {
      return getUserFromCache(normalizedAddress);
    },
    ['user-username', normalizedAddress],
    {
      revalidate: 300, // Cache for 5 minutes
      tags: ['users', `user-${normalizedAddress}`], // Can be invalidated with revalidateTag
    }
  )();
  
  if (user && user.username) {
    return NextResponse.json({ username: user.username });
  }

  return NextResponse.json({ username: null });
}




