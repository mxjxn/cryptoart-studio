import { NextRequest, NextResponse } from "next/server";
import { Alchemy, Network } from "alchemy-sdk";
import { request, gql } from "graphql-request";

const getSubgraphEndpoint = (): string | null => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  return envEndpoint || null;
};

const CHECK_TOKEN_LISTINGS_QUERY = gql`
  query CheckTokenListings($tokenAddress: String!, $tokenIds: [String!]!) {
    listings(
      where: {
        tokenAddress: $tokenAddress
        tokenId_in: $tokenIds
        status: "ACTIVE"
        finalized: false
      }
      first: 1000
    ) {
      tokenId
      totalAvailable
      totalSold
    }
  }
`;

/**
 * Check which tokens are already listed or sold
 * Returns a Set of tokenIds that are sold out
 */
async function getSoldOutTokens(
  contractAddress: string,
  tokenIds: string[]
): Promise<Set<string>> {
  const endpoint = getSubgraphEndpoint();
  if (!endpoint || tokenIds.length === 0) {
    return new Set();
  }

  try {
    const data = await request<{
      listings: Array<{
        tokenId: string;
        totalAvailable: number;
        totalSold: number;
      }>;
    }>(endpoint, CHECK_TOKEN_LISTINGS_QUERY, {
      tokenAddress: contractAddress.toLowerCase(),
      tokenIds: tokenIds,
    });

    const soldOutTokens = new Set<string>();
    (data.listings || []).forEach((listing) => {
      // Token is sold out if totalSold >= totalAvailable
      if (listing.totalSold >= listing.totalAvailable) {
        soldOutTokens.add(listing.tokenId);
      }
    });

    return soldOutTokens;
  } catch (error) {
    console.error("Error checking token listings:", error);
    // Fail open - if subgraph is down, don't filter tokens
    return new Set();
  }
}

/**
 * Get NFTs owned by an address from a specific contract
 * 
 * GET /api/nfts/for-owner?owner=0x...&contractAddress=0x...&page=1&limit=20
 * 
 * Returns: { 
 *   nfts: Array<{ tokenId: string; name: string | null; image: string | null; balance?: string }>, 
 *   total: number,
 *   page: number,
 *   limit: number,
 *   hasMore: boolean
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const contractAddress = searchParams.get("contractAddress");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

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

    if (page < 1) {
      return NextResponse.json(
        { error: "Page must be >= 1" },
        { status: 400 }
      );
    }

    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Limit must be between 1 and 100" },
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

    // Get all NFTs owned by the address from the specific contract
    // Note: Alchemy's getNftsForOwner doesn't support pagination directly for a single contract
    // We'll fetch all and paginate in-memory
    const response = await alchemy.nft.getNftsForOwner(owner, {
      contractAddresses: [contractAddress],
    });

    // Format the NFTs for the response, including balance for ERC1155
    const allNfts = response.ownedNfts.map((nft) => ({
      tokenId: nft.tokenId,
      name: nft.name || `Token #${nft.tokenId}`,
      image: nft.image?.originalUrl || nft.image?.pngUrl || nft.image?.cachedUrl || null,
      animationUrl: nft.raw?.metadata?.animation_url || null,
      animationFormat: nft.raw?.metadata?.animation_details?.format || null,
      description: nft.description || null,
      // Include balance for ERC1155 tokens
      balance: nft.balance ? String(nft.balance) : undefined,
    }));

    // Check which tokens are already sold out in active listings
    const tokenIds = allNfts.map((nft) => nft.tokenId);
    const soldOutTokens = await getSoldOutTokens(contractAddress, tokenIds);

    // Filter out tokens that are sold out
    const availableNfts = allNfts.filter((nft) => !soldOutTokens.has(nft.tokenId));

    // Sort by token ID (convert to number if possible, otherwise lexicographic)
    availableNfts.sort((a, b) => {
      try {
        const aNum = BigInt(a.tokenId);
        const bNum = BigInt(b.tokenId);
        return aNum < bNum ? -1 : aNum > bNum ? 1 : 0;
      } catch {
        return a.tokenId.localeCompare(b.tokenId);
      }
    });

    // Apply pagination
    const total = availableNfts.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const nfts = availableNfts.slice(startIndex, endIndex);
    const hasMore = endIndex < total;

    return NextResponse.json({
      nfts,
      total,
      page,
      limit,
      hasMore,
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

