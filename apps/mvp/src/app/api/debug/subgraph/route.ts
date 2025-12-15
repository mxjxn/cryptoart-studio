import { NextResponse } from "next/server";
import { request, gql } from "graphql-request";

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
};

const getSubgraphHeaders = (): Record<string, string> => {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
  return {};
};

// Simple test query
const TEST_QUERY = gql`
  query {
    listings(first: 5, orderBy: createdAt, orderDirection: desc) {
      id
      listingId
      status
      finalized
      createdAt
      seller
      tokenAddress
      tokenId
    }
  }
`;

// Count query
const COUNT_QUERY = gql`
  query {
    listings(first: 1) {
      id
    }
  }
`;

export async function GET() {
  const endpoint = getSubgraphEndpoint();
  
  const results: any = {
    endpoint,
    timestamp: new Date().toISOString(),
    tests: {},
  };

  // Test 1: Basic connectivity
  try {
    const start = Date.now();
    const data = await request<{ listings: Array<{ id: string }> }>(endpoint, COUNT_QUERY, {}, getSubgraphHeaders());
    const duration = Date.now() - start;
    results.tests.connectivity = {
      success: true,
      duration,
      message: "Subgraph is accessible",
    };
  } catch (error: any) {
    results.tests.connectivity = {
      success: false,
      error: error.message,
      response: error.response,
      message: "Subgraph is not accessible",
    };
    return NextResponse.json(results, { status: 500 });
  }

  // Test 2: Get listings
  try {
    const start = Date.now();
    const data = await request<{ listings: Array<{ id: string; listingId: string; status: string; finalized: boolean; createdAt: string; seller: string; tokenAddress: string; tokenId: string }> }>(endpoint, TEST_QUERY, {}, getSubgraphHeaders());
    const duration = Date.now() - start;
    const count = data.listings?.length || 0;
    results.tests.listings = {
      success: true,
      duration,
      count,
      listings: data.listings,
      message: count > 0 
        ? `Found ${count} listings` 
        : "Subgraph accessible but returns 0 listings",
    };
  } catch (error: any) {
    results.tests.listings = {
      success: false,
      error: error.message,
      response: error.response,
      message: "Failed to fetch listings",
    };
  }

  // Summary
  const allPassed = Object.values(results.tests).every((test: any) => test.success);
  results.summary = {
    allTestsPassed: allPassed,
    totalTests: Object.keys(results.tests).length,
    passedTests: Object.values(results.tests).filter((test: any) => test.success).length,
  };

  return NextResponse.json(results, { 
    status: allPassed ? 200 : 500 
  });
}

