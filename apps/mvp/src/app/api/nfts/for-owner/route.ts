import { NextRequest, NextResponse } from "next/server";
import { Alchemy, Network } from "alchemy-sdk";

/**
 * Get NFTs owned by an address from a specific contract
 * 
 * GET /api/nfts/for-owner?owner=0x...&contractAddress=0x...
 * 
 * Returns: { nfts: Array<{ tokenId: string; name: string | null; image: string | null }> }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const contractAddress = searchParams.get("contractAddress");

    if (!owner || !/^0x[a-fA-F0-9]{40}$/i.test(owner)) {
      return NextResponse.json(
        { error: "Invalid owner address format" },
        { status: 400 }
      );
    }

    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/i.test(contractAddress)) {
      return NextResponse.json(
        { error: "Invalid contract address format" },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Alchemy API key not configured" },
        { status: 500 }
      );
    }

    // Configure Alchemy for server-side use in Next.js
    const alchemy = new Alchemy({
      apiKey,
      network: Network.BASE_MAINNET,
      connectionInfoOverrides: {
        skipFetchSetup: true,
      },
      maxRetries: 3,
      requestTimeout: 10000,
    });

    // Get NFTs owned by the address from the specific contract
    // Metadata is included by default in getNftsForOwner
    const response = await alchemy.nft.getNftsForOwner(owner, {
      contractAddresses: [contractAddress],
    });

    // Format the NFTs for the response
    const nfts = response.ownedNfts.map((nft) => ({
      tokenId: nft.tokenId,
      name: nft.name || `Token #${nft.tokenId}`,
      image: nft.image?.originalUrl || nft.image?.pngUrl || nft.image?.cachedUrl || null,
      animationUrl: nft.raw?.metadata?.animation_url || null,
      animationFormat: nft.raw?.metadata?.animation_details?.format || null,
      description: nft.description || null,
    }));

    // Sort by token ID (convert to number if possible, otherwise lexicographic)
    nfts.sort((a, b) => {
      try {
        const aNum = BigInt(a.tokenId);
        const bNum = BigInt(b.tokenId);
        return aNum < bNum ? -1 : aNum > bNum ? 1 : 0;
      } catch {
        return a.tokenId.localeCompare(b.tokenId);
      }
    });

    return NextResponse.json({
      nfts,
    });
  } catch (error) {
    console.error("Error fetching NFTs for owner:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch NFTs",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

