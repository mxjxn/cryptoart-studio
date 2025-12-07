import { NextRequest, NextResponse } from "next/server";
import { getCachedContracts } from "~/lib/server/contract-cache";

/**
 * Get cached contracts for an address (fast path)
 * 
 * GET /api/contracts/cached/[address]
 * 
 * Returns: { contracts: Array<{ address: string; name: string | null; tokenType: string }> }
 * 
 * This endpoint returns instantly from database cache without hitting Alchemy
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

    const contracts = await getCachedContracts(address);

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

