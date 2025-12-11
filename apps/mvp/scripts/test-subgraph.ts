#!/usr/bin/env tsx
/**
 * Test script to diagnose subgraph issues
 * Usage: tsx scripts/test-subgraph.ts
 */

import { request, gql } from "graphql-request";

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;

if (!SUBGRAPH_URL) {
  console.error("❌ NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL not set");
  process.exit(1);
}

// TypeScript now knows SUBGRAPH_URL is defined
const subgraphUrl: string = SUBGRAPH_URL;

console.log("🔍 Testing subgraph:", subgraphUrl);
console.log("");

// Test 1: Simple query to get total count
const COUNT_QUERY = gql`
  query {
    listings(first: 1) {
      id
      listingId
      status
    }
  }
`;

// Test 2: Get all listings with minimal fields
const ALL_LISTINGS_QUERY = gql`
  query {
    listings(
      first: 10
      orderBy: createdAt
      orderDirection: desc
    ) {
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

// Test 3: Count by status
const STATUS_COUNT_QUERY = gql`
  query {
    active: listings(where: { status: "ACTIVE" }, first: 1) {
      id
    }
    cancelled: listings(where: { status: "CANCELLED" }, first: 1) {
      id
    }
    finalized: listings(where: { status: "FINALIZED" }, first: 1) {
      id
    }
  }
`;

async function testQuery(name: string, query: any, variables?: any) {
  console.log(`\n📊 Test: ${name}`);
  console.log("─".repeat(50));
  const start = Date.now();
  try {
    const data = await request(subgraphUrl, query, variables, {
      timeout: 30000,
    });
    const duration = Date.now() - start;
    console.log(`✅ Success (${duration}ms)`);
    console.log(JSON.stringify(data, null, 2));
    return { success: true, data, duration };
  } catch (error: any) {
    const duration = Date.now() - start;
    console.log(`❌ Failed (${duration}ms)`);
    console.error("Error:", error.message);
    if (error.response) {
      console.error("Response:", JSON.stringify(error.response, null, 2));
    }
    return { success: false, error: error.message, duration };
  }
}

async function main() {
  console.log("🚀 Starting subgraph diagnostics...\n");

  // Test basic connectivity
  const test1 = await testQuery("Basic connectivity test", COUNT_QUERY);
  
  if (!test1.success) {
    console.log("\n❌ Subgraph is not accessible. Check:");
    console.log("   1. Is the subgraph URL correct?");
    console.log("   2. Is the subgraph deployed and synced?");
    console.log("   3. Are there network/firewall issues?");
    return;
  }

  // Test getting listings
  const test2 = await testQuery("Get recent listings", ALL_LISTINGS_QUERY);
  
  // Test status counts
  const test3 = await testQuery("Count by status", STATUS_COUNT_QUERY);

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📋 Summary");
  console.log("=".repeat(50));
  console.log(`Basic connectivity: ${test1.success ? "✅" : "❌"}`);
  console.log(`Get listings: ${test2.success ? "✅" : "❌"}`);
  if (test2.success && test2.data) {
    const count = test2.data.listings?.length || 0;
    console.log(`   Found ${count} listings`);
  }
  console.log(`Status counts: ${test3.success ? "✅" : "❌"}`);
  
  if (test2.success && test2.data?.listings?.length === 0) {
    console.log("\n⚠️  WARNING: Subgraph is accessible but returns 0 listings!");
    console.log("   This could mean:");
    console.log("   1. The subgraph hasn't indexed any events yet");
    console.log("   2. The startBlock in subgraph.yaml is too high");
    console.log("   3. The contract address in subgraph.yaml is incorrect");
    console.log("   4. No listings have been created on the contract");
  }
}

main().catch(console.error);
