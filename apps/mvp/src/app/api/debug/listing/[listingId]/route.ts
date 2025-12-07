import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from "~/lib/contracts/marketplace";
import { request as graphqlRequest } from "graphql-request";

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

    // Compare key fields
    const comparison: any = {};
    if (contractData && !contractData.error && subgraphData && !subgraphData.error) {
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
    }

    return NextResponse.json({
      listingId,
      contract: contractData,
      subgraph: subgraphData,
      comparison,
      timestamp: new Date().toISOString(),
    });
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

