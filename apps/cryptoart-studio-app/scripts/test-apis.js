#!/usr/bin/env node

/**
 * Creator Tools & Airdrop APIs Test Suite
 * 
 * This script tests all the implemented API endpoints to verify they work correctly.
 * Run with: node scripts/test-apis.js
 * 
 * Prerequisites:
 * 1. Set up environment variables (see setup instructions below)
 * 2. Ensure database is migrated
 * 3. Have a valid FID with /cryptoart Hypersub membership
 */

import fetch from 'node-fetch';

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
const TEST_FID = process.env.TEST_FID || '4905'; // Your FID from the CSV data
const TEST_TOKEN_ADDRESS = process.env.TEST_TOKEN_ADDRESS || '0x...'; // Any ERC20 token on Base
const TEST_NFT_CONTRACT = process.env.TEST_NFT_CONTRACT || '0x...'; // Any NFT contract on Base

// Test utilities
function logTest(testName: string, success: boolean, details?: any) {
  const status = success ? '✅' : '❌';
  console.log(`${status} ${testName}`);
  if (details && !success) {
    console.log(`   Error: ${details}`);
  }
}

async function makeRequest(endpoint: string, options: any = {}) {
  try {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    const data = await response.json();
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test functions
async function testFollowers() {
  console.log('\n📊 Testing Data APIs...');
  
  const result = await makeRequest(`/api/data/followers?fid=${TEST_FID}&limit=10`);
  logTest('Followers API', result.success, result.error || result.data?.error);
  
  if (result.success) {
    console.log(`   Found ${result.data.followers?.length || 0} followers`);
  }
}

async function testChannelActivity() {
  const result = await makeRequest(`/api/data/channel-activity?fid=${TEST_FID}`);
  logTest('Channel Activity API', result.success, result.error || result.data?.error);
  
  if (result.success) {
    console.log(`   Activity stats: ${JSON.stringify(result.data.activityStats)}`);
  }
}

async function testTokenHolders() {
  const result = await makeRequest(`/api/data/token-holders?fids=${TEST_FID}&tokenAddress=${TEST_TOKEN_ADDRESS}&minAmount=0`);
  logTest('Token Holders API', result.success, result.error || result.data?.error);
  
  if (result.success) {
    console.log(`   Found ${result.data.holders?.length || 0} token holders`);
  }
}

async function testNFTHolders() {
  const result = await makeRequest(`/api/data/nft-holders?fids=${TEST_FID}&contractAddress=${TEST_NFT_CONTRACT}&minBalance=1`);
  logTest('NFT Holders API', result.success, result.error || result.data?.error);
  
  if (result.success) {
    console.log(`   Found ${result.data.holders?.length || 0} NFT holders`);
  }
}

async function testClankerTokens() {
  const result = await makeRequest(`/api/data/clanker-tokens?fid=${TEST_FID}`);
  logTest('Clanker Tokens API', result.success, result.error || result.data?.error);
  
  if (result.success) {
    console.log(`   Found ${result.data.tokens?.length || 0} Clanker tokens`);
  }
}

async function testHypersubMembers() {
  const result = await makeRequest(`/api/data/hypersub-members?fids=${TEST_FID}&contractAddress=${process.env.CRYPTOART_HYPERSUB_CONTRACT || '0x...'}`);
  logTest('Hypersub Members API', result.success, result.error || result.data?.error);
  
  if (result.success) {
    console.log(`   Found ${result.data.members?.length || 0} Hypersub members`);
  }
}

async function testBulkQuery() {
  const result = await makeRequest('/api/data/bulk-query', {
    method: 'POST',
    body: JSON.stringify({
      fids: [parseInt(TEST_FID)],
      filters: {
        token: {
          tokenAddress: TEST_TOKEN_ADDRESS,
          minAmount: '0'
        }
      }
    }),
  });
  
  logTest('Bulk Query API', result.success, result.error || result.data?.error);
  
  if (result.success) {
    console.log(`   Found ${result.data.matchingUsers || 0} matching users`);
  }
}

async function testListsCRUD() {
  console.log('\n📋 Testing List Management APIs...');
  
  // Create a test list
  const createResult = await makeRequest('/api/lists', {
    method: 'POST',
    body: JSON.stringify({
      fid: TEST_FID,
      name: 'Test Airdrop List',
      description: 'Created by API test script'
    }),
  });
  
  logTest('Create List', createResult.success, createResult.error || createResult.data?.error);
  
  if (!createResult.success) return;
  
  const listId = createResult.data.list?.id;
  
  // Get lists
  const getResult = await makeRequest(`/api/lists?fid=${TEST_FID}`);
  logTest('Get Lists', getResult.success, getResult.error || getResult.data?.error);
  
  // Add recipients
  const addRecipientsResult = await makeRequest(`/api/lists/${listId}/recipients`, {
    method: 'POST',
    body: JSON.stringify({
      fid: TEST_FID,
      listId: listId,
      recipients: [
        { fid: parseInt(TEST_FID) },
        { walletAddress: '0x1234567890123456789012345678901234567890' }
      ]
    }),
  });
  
  logTest('Add Recipients', addRecipientsResult.success, addRecipientsResult.error || addRecipientsResult.data?.error);
  
  // Get recipients
  const getRecipientsResult = await makeRequest(`/api/lists/${listId}/recipients?fid=${TEST_FID}&listId=${listId}`);
  logTest('Get Recipients', getRecipientsResult.success, getRecipientsResult.error || getRecipientsResult.data?.error);
  
  // Clean up - delete the test list
  const deleteResult = await makeRequest(`/api/lists?fid=${TEST_FID}&listId=${listId}`, {
    method: 'DELETE',
  });
  
  logTest('Delete List', deleteResult.success, deleteResult.error || deleteResult.data?.error);
}

async function testAirdropPrepare() {
  console.log('\n🎁 Testing Airdrop APIs...');
  
  const result = await makeRequest('/api/airdrop/prepare', {
    method: 'POST',
    body: JSON.stringify({
      fid: TEST_FID,
      tokenAddress: TEST_TOKEN_ADDRESS,
      recipients: ['0x1234567890123456789012345678901234567890', '0x0987654321098765432109876543210987654321'],
      amounts: ['1000000000000000000', '2000000000000000000'] // 1 and 2 tokens (assuming 18 decimals)
    }),
  });
  
  logTest('Airdrop Prepare', result.success, result.error || result.data?.error);
  
  if (result.success) {
    console.log(`   Gas estimate: ${result.data.gasEstimate}`);
    console.log(`   Total amount: ${result.data.validation?.totalAmount}`);
  }
}

async function testAirdropHistory() {
  const result = await makeRequest(`/api/airdrop/history?fid=${TEST_FID}&limit=10`);
  logTest('Airdrop History', result.success, result.error || result.data?.error);
  
  if (result.success) {
    console.log(`   Found ${result.data.airdrops?.length || 0} airdrop records`);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Creator Tools & Airdrop APIs Test Suite');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log(`👤 Using test FID: ${TEST_FID}`);
  
  // Test data APIs
  await testFollowers();
  await testChannelActivity();
  await testTokenHolders();
  await testNFTHolders();
  await testClankerTokens();
  await testHypersubMembers();
  await testBulkQuery();
  
  // Test list management
  await testListsCRUD();
  
  // Test airdrop functionality
  await testAirdropPrepare();
  await testAirdropHistory();
  
  console.log('\n✨ Test suite completed!');
  console.log('\n📝 Next steps:');
  console.log('1. Check any failed tests above');
  console.log('2. Verify environment variables are set correctly');
  console.log('3. Ensure database migrations have been run');
  console.log('4. Test with real data by updating TEST_FID and contract addresses');
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };
