import { NextRequest, NextResponse } from "next/server";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";
import { 
  getCachedContracts, 
  getLastCheckedBlock, 
  cacheDeployedContract, 
  updateLastCheckedBlockForCreator 
} from "~/lib/server/contract-cache";

/**
 * Get NFT contracts deployed by an address on Base Mainnet
 * 
 * GET /api/contracts/deployed/[address]?refresh=true
 * 
 * Returns: { contracts: Array<{ address: string; name: string | null; tokenType: string }> }
 * 
 * Note: Only fetches contracts deployed on Base Mainnet (this is a Base-only site)
 * 
 * Caching behavior:
 * - Returns cached contracts instantly from database
 * - If refresh=true, also checks for new contracts deployed after lastCheckedBlock
 * - Updates cache with new contracts and current block number
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse> {
  try {
    const { address } = await params;
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400 }
      );
    }

    // 1. Get cached contracts (instant return)
    const cachedContracts = await getCachedContracts(address);
    
    // If not refreshing, return cached results immediately
    if (!refresh) {
      return NextResponse.json({
        contracts: cachedContracts,
      });
    }

    // 2. Refresh: Check for new contracts deployed after lastCheckedBlock
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      // If no API key, just return cached results
      return NextResponse.json({
        contracts: cachedContracts,
      });
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

    // Get last checked block, default to 0 if not found (full scan)
    const lastCheckedBlock = await getLastCheckedBlock(address);
    const fromBlock = lastCheckedBlock !== null ? `0x${(lastCheckedBlock + 1).toString(16)}` : "0x0";
    
    // Get current block number for tracking
    let currentBlockNumber: number;
    try {
      const currentBlock = await alchemy.core.getBlockNumber();
      currentBlockNumber = currentBlock;
    } catch {
      // If we can't get current block, skip update
      return NextResponse.json({
        contracts: cachedContracts,
      });
    }

    const newContracts: Array<{ address: string; name: string | null; tokenType: string }> = [];
    const seenAddresses = new Set(cachedContracts.map((c) => c.address.toLowerCase()));
    let pageKey: string | undefined;

    // Only scan from lastCheckedBlock to latest (incremental)
    do {
      try {
        const transfers = await alchemy.core.getAssetTransfers({
          fromBlock,
          toBlock: "latest",
          fromAddress: address,
          category: [AssetTransfersCategory.EXTERNAL],
          excludeZeroValue: false,
          pageKey,
          withMetadata: true,
        });

        // Filter for contract deployments
        const deployments = transfers.transfers.filter((tx) => 
          tx.to === null || tx.to === undefined
        );

        // Process each deployment
        for (const tx of deployments) {
          try {
            let contractAddress: string | null = null;

            // Get contract address from metadata or receipt
            if ((tx as any).metadata?.contractAddress) {
              contractAddress = (tx as any).metadata.contractAddress;
            } else {
              const receipt = await alchemy.core.getTransactionReceipt(tx.hash);
              if (receipt?.contractAddress) {
                contractAddress = receipt.contractAddress;
              }
            }

            if (!contractAddress || seenAddresses.has(contractAddress.toLowerCase())) {
              continue; // Skip if already in cache
            }

            // Check if it's an NFT contract
            try {
              const metadata = await alchemy.nft.getContractMetadata(contractAddress);

              if (metadata.tokenType === "ERC721" || metadata.tokenType === "ERC1155") {
                const contractData = {
                  address: contractAddress,
                  name: metadata.name || null,
                  tokenType: metadata.tokenType,
                };
                
                newContracts.push(contractData);
                seenAddresses.add(contractAddress.toLowerCase());
                
                // Cache the new contract
                await cacheDeployedContract(contractAddress, {
                  name: metadata.name || null,
                  tokenType: metadata.tokenType,
                  creatorAddress: address,
                  lastCheckedBlock: currentBlockNumber,
                });
              }
            } catch {
              // Not an NFT contract - skip silently
            }
          } catch {
            // Error processing deployment - continue
          }
        }

        pageKey = transfers.pageKey;
      } catch (error) {
        console.error("Error fetching asset transfers:", error);
        break; // Break on error
      }
    } while (pageKey);

    // Update lastCheckedBlock for all contracts from this creator
    if (newContracts.length > 0 || lastCheckedBlock === null) {
      await updateLastCheckedBlockForCreator(address, currentBlockNumber);
    }

    // Combine cached and new contracts, then sort
    const allContracts = [...cachedContracts, ...newContracts];
    
    // Remove duplicates (in case of race conditions)
    const uniqueContracts = Array.from(
      new Map(allContracts.map((c) => [c.address.toLowerCase(), c])).values()
    );

    // Sort by name (nulls last)
    uniqueContracts.sort((a, b) => {
      if (!a.name && !b.name) return 0;
      if (!a.name) return 1;
      if (!b.name) return -1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      contracts: uniqueContracts,
    });
  } catch (error) {
    console.error("Error fetching deployed NFT contracts:", error);
    // Return cached results even on error
    try {
      const { address: errorAddress } = await params;
      const cachedContracts = await getCachedContracts(errorAddress).catch(() => []);
      return NextResponse.json({
        contracts: cachedContracts,
        error: "Failed to refresh contracts, returning cached results",
        message: error instanceof Error ? error.message : String(error),
      });
    } catch {
      return NextResponse.json(
        {
          error: "Failed to fetch deployed NFT contracts",
          message: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  }
}

