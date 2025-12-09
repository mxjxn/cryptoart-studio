import { NextRequest, NextResponse } from "next/server";
import { getERC1155TotalSupply, invalidateERC1155SupplyCache } from "~/lib/server/erc1155-supply";

/**
 * Get ERC1155 total supply (cached or fetched)
 * 
 * GET /api/erc1155/supply?contractAddress=0x...&tokenId=...
 * 
 * Query params:
 * - contractAddress: ERC1155 contract address
 * - tokenId: Token ID
 * - refresh: (optional) Force refresh cache
 * 
 * Returns: { totalSupply: string | null, isLazyMint: boolean }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get("contractAddress");
    const tokenId = searchParams.get("tokenId");
    const refresh = searchParams.get("refresh") === "true";

    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/i.test(contractAddress)) {
      return NextResponse.json(
        { error: "Invalid contract address format" },
        { status: 400 }
      );
    }

    if (!tokenId || tokenId.trim() === "") {
      return NextResponse.json(
        { error: "Token ID is required" },
        { status: 400 }
      );
    }

    // Invalidate cache if refresh requested
    if (refresh) {
      await invalidateERC1155SupplyCache(contractAddress, tokenId);
    }

    // Get total supply (from cache or fetch)
    const totalSupply = await getERC1155TotalSupply(contractAddress, tokenId);

    return NextResponse.json({
      totalSupply: totalSupply ? totalSupply.toString() : null,
    });
  } catch (error) {
    console.error("Error fetching ERC1155 total supply:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch total supply",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

