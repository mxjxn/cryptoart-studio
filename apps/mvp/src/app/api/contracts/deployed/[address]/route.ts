import { NextRequest, NextResponse } from "next/server";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";

/**
 * Get NFT contracts deployed by an address on Base Mainnet
 * 
 * GET /api/contracts/deployed/[address]
 * 
 * Returns: { contracts: Array<{ address: string; name: string | null; tokenType: string }> }
 * 
 * Note: Only fetches contracts deployed on Base Mainnet (this is a Base-only site)
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

    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Alchemy API key not configured" },
        { status: 500 }
      );
    }

    // Configure Alchemy for server-side use in Next.js
    // skipFetchSetup: true prevents the SDK from setting problematic headers (like Referrer) 
    // that don't work in server environments
    const alchemy = new Alchemy({
      apiKey,
      network: Network.BASE_MAINNET,
      connectionInfoOverrides: {
        skipFetchSetup: true, // Disables problematic referrer header
      },
      maxRetries: 3,
      requestTimeout: 10000, // 10 seconds
    });

    const contracts: Array<{ address: string; name: string | null; tokenType: string }> = [];
    let pageKey: string | undefined;

    // 1. Get all outbound transactions, paginate
    // Following Alchemy's official approach: https://www.alchemy.com/docs/how-to-get-all-the-contracts-deployed-by-a-wallet
    // Contract deployments are external transactions where 'to' is null
    do {
      const transfers = await alchemy.core.getAssetTransfers({
        fromBlock: "0x0", // Start from genesis block
        toBlock: "latest", // Up to latest block
        fromAddress: address,
        category: [AssetTransfersCategory.EXTERNAL], // Only external transactions contain contract deployments
        excludeZeroValue: false, // Include zero-value transactions (deployments often have 0 value)
        pageKey,
        withMetadata: true, // Include metadata which may have contractAddress
      });

      // 2. Filter for contract deployments (to is null or undefined)
      const deployments = transfers.transfers.filter((tx) => 
        tx.to === null || tx.to === undefined
      );

      // 3. Get contract address from each deployment
      for (const tx of deployments) {
        try {
          let contractAddress: string | null = null;

          // First try to get contract address from metadata if available
          if ((tx as any).metadata?.contractAddress) {
            contractAddress = (tx as any).metadata.contractAddress;
          } else {
            // Fallback: Get from transaction receipt
            const receipt = await alchemy.core.getTransactionReceipt(tx.hash);
            if (receipt?.contractAddress) {
              contractAddress = receipt.contractAddress;
            }
          }

          if (!contractAddress) {
            continue;
          }

          // 4. Check if it's an NFT contract
          try {
            const metadata = await alchemy.nft.getContractMetadata(contractAddress);

            if (metadata.tokenType === "ERC721" || metadata.tokenType === "ERC1155") {
              contracts.push({
                address: contractAddress,
                name: metadata.name || null,
                tokenType: metadata.tokenType,
              });
            }
          } catch {
            // Not an NFT contract or failed to get metadata - skip silently
          }
        } catch {
          // Error processing deployment - continue with next
        }
      }

      pageKey = transfers.pageKey;
    } while (pageKey);

    // Sort contracts by name (nulls last)
    contracts.sort((a, b) => {
      if (!a.name && !b.name) return 0;
      if (!a.name) return 1;
      if (!b.name) return -1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      contracts,
    });
  } catch (error) {
    console.error("Error fetching deployed NFT contracts:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch deployed NFT contracts",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

