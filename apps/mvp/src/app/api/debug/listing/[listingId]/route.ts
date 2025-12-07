import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from "~/lib/contracts/marketplace";
import { request as graphqlRequest } from "graphql-request";

// ERC1155 ABI for balance check
const ERC1155_ABI = parseAbi([
  'function balanceOf(address account, uint256 id) view returns (uint256)',
]);

// ERC721 ABI for owner check
const ERC721_ABI = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
]);

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error("Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL");
};

const getSubgraphHeaders = (): Record<string, string> => {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY || process.env.NEXT_PUBLIC_GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
  return {};
};

const LISTING_QUERY = `
  query GetListing($id: BigInt!) {
    listing(id: $id) {
      id
      listingId
      seller
      tokenAddress
      tokenId
      tokenSpec
      lazy
      listingType
      initialAmount
      totalAvailable
      totalPerSale
      totalSold
      startTime
      endTime
      status
      finalized
      erc20
      marketplaceBPS
      referrerBPS
    }
  }
`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
): Promise<NextResponse> {
  try {
    const { listingId } = await params;
    const listingIdNum = parseInt(listingId);

    if (isNaN(listingIdNum)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 }
      );
    }

    // Create public client for contract reads
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    // Read from contract
    let contractData: any = null;
    try {
      contractData = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "getListing",
        args: [listingIdNum],
      });
    } catch (error: any) {
      console.error("Error reading contract:", error);
      contractData = { error: error.message };
    }

    // Read from subgraph
    let subgraphData: any = null;
    try {
      const endpoint = getSubgraphEndpoint();
      const headers = getSubgraphHeaders();
      const result = await graphqlRequest<{ listing: any | null }>(
        endpoint,
        LISTING_QUERY,
        { id: listingId },
        headers
      );
      subgraphData = result.listing;
    } catch (error: any) {
      console.error("Error reading subgraph:", error);
      subgraphData = { error: error.message };
    }

    // Helper to normalize listingType to string
    const getListingTypeString = (type: number | string | undefined): string => {
      const typeMap: Record<number, string> = {
        0: "INVALID",
        1: "INDIVIDUAL_AUCTION", 
        2: "FIXED_PRICE",
        3: "DYNAMIC_PRICE",
        4: "OFFERS_ONLY",
      };
      if (typeof type === 'number') return typeMap[type] || "UNKNOWN";
      if (typeof type === 'string') {
        const num = parseInt(type);
        if (!isNaN(num)) return typeMap[num] || "UNKNOWN";
        return type;
      }
      return "UNDEFINED";
    };

    // Helper to normalize tokenSpec to string  
    const getTokenSpecString = (spec: number | string | undefined): string => {
      const specMap: Record<number, string> = {
        0: "NONE",
        1: "ERC721",
        2: "ERC1155",
      };
      if (typeof spec === 'number') return specMap[spec] || "UNKNOWN";
      if (typeof spec === 'string') {
        const num = parseInt(spec);
        if (!isNaN(num)) return specMap[num] || "UNKNOWN";
        return spec;
      }
      return "UNDEFINED";
    };

    // Compare key fields
    const comparison: any = {};
    if (contractData && !contractData.error && subgraphData && !subgraphData.error) {
      // Listing type comparison (critical for auction vs buy now display)
      const contractListingType = contractData.details?.type_;
      const subgraphListingType = subgraphData.listingType;
      comparison.listingType = {
        contract: {
          raw: contractListingType,
          type: typeof contractListingType,
          normalized: getListingTypeString(contractListingType),
        },
        subgraph: {
          raw: subgraphListingType,
          type: typeof subgraphListingType,
          normalized: getListingTypeString(subgraphListingType),
        },
        match: getListingTypeString(contractListingType) === getListingTypeString(subgraphListingType),
      };

      // Token spec comparison (ERC721 vs ERC1155)
      const contractTokenSpec = contractData.token?.spec;
      const subgraphTokenSpec = subgraphData.tokenSpec;
      comparison.tokenSpec = {
        contract: {
          raw: contractTokenSpec,
          type: typeof contractTokenSpec,
          normalized: getTokenSpecString(contractTokenSpec),
        },
        subgraph: {
          raw: subgraphTokenSpec,
          type: typeof subgraphTokenSpec,
          normalized: getTokenSpecString(subgraphTokenSpec),
        },
        match: getTokenSpecString(contractTokenSpec) === getTokenSpecString(subgraphTokenSpec),
      };

      comparison.totalAvailable = {
        contract: contractData.details?.totalAvailable?.toString(),
        subgraph: subgraphData.totalAvailable?.toString(),
        match: contractData.details?.totalAvailable?.toString() === subgraphData.totalAvailable?.toString(),
      };
      comparison.totalSold = {
        contract: contractData.totalSold?.toString(),
        subgraph: subgraphData.totalSold?.toString(),
        match: contractData.totalSold?.toString() === subgraphData.totalSold?.toString(),
      };
      comparison.totalPerSale = {
        contract: contractData.details?.totalPerSale?.toString(),
        subgraph: subgraphData.totalPerSale?.toString(),
        match: contractData.details?.totalPerSale?.toString() === subgraphData.totalPerSale?.toString(),
      };
      comparison.status = {
        contract: contractData.finalized ? "FINALIZED" : "ACTIVE",
        subgraph: subgraphData.status,
        match: (contractData.finalized ? "FINALIZED" : "ACTIVE") === subgraphData.status,
      };
      
      // Initial amount (price) comparison
      comparison.initialAmount = {
        contract: contractData.details?.initialAmount?.toString(),
        subgraph: subgraphData.initialAmount?.toString(),
        match: contractData.details?.initialAmount?.toString() === subgraphData.initialAmount?.toString(),
      };

      // Calculate available copies
      const contractAvailable = contractData.details?.totalAvailable 
        ? parseInt(contractData.details.totalAvailable.toString()) 
        : 0;
      const contractSold = contractData.totalSold 
        ? parseInt(contractData.totalSold.toString()) 
        : 0;
      const contractPerSale = contractData.details?.totalPerSale 
        ? parseInt(contractData.details.totalPerSale.toString()) 
        : 1;
      const contractRemaining = Math.max(0, contractAvailable - contractSold);
      const contractMaxPurchases = Math.floor(contractRemaining / contractPerSale);

      const subgraphAvailable = subgraphData.totalAvailable 
        ? parseInt(subgraphData.totalAvailable.toString()) 
        : 0;
      const subgraphSold = subgraphData.totalSold 
        ? parseInt(subgraphData.totalSold.toString()) 
        : 0;
      const subgraphPerSale = subgraphData.totalPerSale 
        ? parseInt(subgraphData.totalPerSale.toString()) 
        : 1;
      const subgraphRemaining = Math.max(0, subgraphAvailable - subgraphSold);
      const subgraphMaxPurchases = Math.floor(subgraphRemaining / subgraphPerSale);

      comparison.availableCopies = {
        contract: {
          totalAvailable: contractAvailable,
          totalSold: contractSold,
          totalPerSale: contractPerSale,
          remaining: contractRemaining,
          maxPurchases: contractMaxPurchases,
        },
        subgraph: {
          totalAvailable: subgraphAvailable,
          totalSold: subgraphSold,
          totalPerSale: subgraphPerSale,
          remaining: subgraphRemaining,
          maxPurchases: subgraphMaxPurchases,
        },
      };

      // Helper to safely format timestamp
      const safeFormatTime = (timestamp: number): string => {
        if (timestamp === 0) return "0 (starts on first bid/purchase)";
        // Check for reasonable timestamp range (1970 to 2100)
        if (timestamp < 0 || timestamp > 4102444800) {
          return `${timestamp} (invalid/overflow)`;
        }
        try {
          return new Date(timestamp * 1000).toISOString();
        } catch {
          return `${timestamp} (format error)`;
        }
      };

      // Timing comparison
      const now = Math.floor(Date.now() / 1000);
      const contractStartTime = contractData.details?.startTime 
        ? parseInt(contractData.details.startTime.toString()) 
        : 0;
      const contractEndTime = contractData.details?.endTime 
        ? parseInt(contractData.details.endTime.toString()) 
        : 0;
      const subgraphStartTime = subgraphData.startTime 
        ? parseInt(subgraphData.startTime.toString()) 
        : 0;
      const subgraphEndTime = subgraphData.endTime 
        ? parseInt(subgraphData.endTime.toString()) 
        : 0;

      // Check if endTime looks like "never expires" (max uint48 or very large value)
      const isNeverExpiring = contractEndTime > 4000000000; // After year 2096

      comparison.timing = {
        now,
        nowFormatted: safeFormatTime(now),
        contract: {
          startTime: contractStartTime,
          startTimeFormatted: safeFormatTime(contractStartTime),
          endTime: contractEndTime,
          endTimeFormatted: isNeverExpiring ? "Never expires (max value)" : safeFormatTime(contractEndTime),
          hasStarted: contractStartTime === 0 || now >= contractStartTime,
          hasEnded: !isNeverExpiring && now >= contractEndTime,
          isActive: (contractStartTime === 0 || now >= contractStartTime) && (isNeverExpiring || now < contractEndTime),
          isNeverExpiring,
        },
        subgraph: {
          startTime: subgraphStartTime,
          endTime: subgraphEndTime,
        },
      };

      // Token details
      comparison.tokenDetails = {
        contract: {
          tokenId: contractData.token?.id?.toString(),
          tokenAddress: contractData.token?.address_,
          spec: getTokenSpecString(contractData.token?.spec),
          lazy: contractData.token?.lazy,
        },
        subgraph: {
          tokenId: subgraphData.tokenId?.toString(),
          tokenAddress: subgraphData.tokenAddress,
          spec: getTokenSpecString(subgraphData.tokenSpec),
          lazy: subgraphData.lazy,
        },
      };

      // Purchase eligibility check
      const listingTypeStr = getListingTypeString(contractData.details?.type_);
      const isPurchasable = listingTypeStr === "FIXED_PRICE" || listingTypeStr === "DYNAMIC_PRICE";
      const isWithinTimeWindow = (contractStartTime === 0 || now >= contractStartTime) && (isNeverExpiring || now < contractEndTime);
      const hasStock = contractRemaining >= contractPerSale;
      const isNotFinalized = !contractData.finalized;

      comparison.purchaseEligibility = {
        isPurchasable,
        isPurchasableReason: isPurchasable 
          ? "Listing type supports purchase" 
          : `Listing type ${listingTypeStr} requires bidding, not purchase`,
        isWithinTimeWindow,
        isWithinTimeWindowReason: isWithinTimeWindow 
          ? "Current time is within listing window"
          : now < contractStartTime 
            ? `Listing hasn't started (starts at ${safeFormatTime(contractStartTime)})`
            : `Listing has ended (ended at ${safeFormatTime(contractEndTime)})`,
        hasStock,
        hasStockReason: hasStock 
          ? `${contractRemaining} copies remaining, ${contractPerSale} per purchase`
          : `No stock remaining (${contractRemaining} < ${contractPerSale} per purchase)`,
        isNotFinalized,
        isNotFinalizedReason: isNotFinalized 
          ? "Listing is not finalized"
          : "Listing is already finalized",
        canPurchase: isPurchasable && isWithinTimeWindow && hasStock && isNotFinalized,
        requiredPayment: contractData.details?.initialAmount?.toString(),
        requiredPaymentFormatted: contractData.details?.initialAmount 
          ? `${(BigInt(contractData.details.initialAmount) / BigInt(10**15)).toString()} finney (${(BigInt(contractData.details.initialAmount) / BigInt(10**18)).toString()} ETH)`
          : "unknown",
      };

      // Token ownership check (critical for non-lazy listings)
      const isLazy = contractData.token?.lazy === true;
      const tokenSpec = getTokenSpecString(contractData.token?.spec);
      const tokenAddress = contractData.token?.address_;
      const tokenId = contractData.token?.id;

      if (!isLazy && tokenAddress && tokenId !== undefined) {
        try {
          if (tokenSpec === "ERC1155") {
            // For ERC1155, check marketplace balance
            const marketplaceBalance = await publicClient.readContract({
              address: tokenAddress,
              abi: ERC1155_ABI,
              functionName: "balanceOf",
              args: [MARKETPLACE_ADDRESS, tokenId],
            });
            
            comparison.tokenOwnership = {
              isLazy,
              tokenSpec,
              tokenAddress,
              tokenId: tokenId.toString(),
              marketplaceBalance: marketplaceBalance.toString(),
              requiredForPurchase: contractPerSale.toString(),
              hasEnoughTokens: Number(marketplaceBalance) >= contractPerSale,
              issue: Number(marketplaceBalance) < contractPerSale 
                ? `Marketplace only has ${marketplaceBalance} tokens but needs ${contractPerSale} per purchase. Seller may not have deposited tokens or listing was already purchased.`
                : null,
            };
          } else if (tokenSpec === "ERC721") {
            // For ERC721, check owner
            const owner = await publicClient.readContract({
              address: tokenAddress,
              abi: ERC721_ABI,
              functionName: "ownerOf",
              args: [tokenId],
            });
            
            const marketplaceOwnsToken = owner.toLowerCase() === MARKETPLACE_ADDRESS.toLowerCase();
            
            comparison.tokenOwnership = {
              isLazy,
              tokenSpec,
              tokenAddress,
              tokenId: tokenId.toString(),
              currentOwner: owner,
              marketplaceAddress: MARKETPLACE_ADDRESS,
              marketplaceOwnsToken,
              issue: !marketplaceOwnsToken 
                ? `Token is owned by ${owner}, not the marketplace. Seller may not have deposited token or it was already sold.`
                : null,
            };
          }
        } catch (tokenError: any) {
          comparison.tokenOwnership = {
            isLazy,
            tokenSpec,
            tokenAddress,
            tokenId: tokenId?.toString(),
            error: tokenError.message,
          };
        }
      } else if (isLazy) {
        comparison.tokenOwnership = {
          isLazy: true,
          note: "Lazy listing - tokens will be minted/delivered on purchase",
        };
      }
    }

    // Helper to convert BigInts to strings for JSON serialization
    const serializeBigInts = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return obj.toString();
      if (Array.isArray(obj)) return obj.map(serializeBigInts);
      if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = serializeBigInts(value);
        }
        return result;
      }
      return obj;
    };

    return NextResponse.json(serializeBigInts({
      listingId,
      contract: contractData,
      subgraph: subgraphData,
      comparison,
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Error in diagnostic route:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch diagnostic data",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

