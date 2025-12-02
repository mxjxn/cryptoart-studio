import { NextRequest, NextResponse } from "next/server";
import { getContractCreator } from "~/lib/contract-creator";

/**
 * Contract creator lookup API endpoint.
 * 
 * GET /api/contract-creator/[address]?tokenId=123
 * 
 * Returns: { creator: string | null, source: 'owner' | 'creator' | 'royalty' | null }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse> {
  const { address } = await params;
  const { searchParams } = new URL(request.url);
  const tokenIdParam = searchParams.get("tokenId");

  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.json(
      { error: "Invalid contract address" },
      { status: 400 }
    );
  }

  const tokenId = tokenIdParam ? BigInt(tokenIdParam) : undefined;

  try {
    const result = await getContractCreator(address, tokenId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error getting contract creator:", error);
    return NextResponse.json(
      { error: "Failed to get contract creator", creator: null, source: null },
      { status: 500 }
    );
  }
}

