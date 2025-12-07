import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getCachedContracts } from "~/lib/server/contract-cache";

/**
 * Get cached contracts for an address (fast path)
 * 
 * GET /api/contracts/cached/[address]
 * 
 * Returns: { contracts: Array<{ address: string; name: string | null; tokenType: string }> }
 * 
 * This endpoint returns instantly from database cache without hitting Alchemy
 * Route-level caching: 5 minutes (prevents database pool exhaustion)
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse> {
  try {
    const { address } = await params;

    if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400 }
      );
    }

    // Normalize address for cache key
    const normalizedAddress = address.toLowerCase();

    // Use unstable_cache to prevent database pool exhaustion
    // The cache key includes the address so each address has its own cache entry
    const contracts = await unstable_cache(
      async () => {
        return getCachedContracts(normalizedAddress);
      },
      ['cached-contracts', normalizedAddress],
      {
        revalidate: 300, // Cache for 5 minutes
        tags: ['contracts', `contracts-${normalizedAddress}`], // Can be invalidated with revalidateTag
      }
    )();

    return NextResponse.json({
      contracts,
    });
  } catch (error) {
    console.error("Error fetching cached contracts:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch cached contracts",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

