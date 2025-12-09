#!/usr/bin/env tsx
/**
 * Route Testing Script
 * 
 * Tests all API routes to validate they work correctly.
 * Run with: pnpm tsx scripts/test-routes.ts
 * 
 * Note: This requires the dev server to be running on localhost:3000
 * or set BASE_URL environment variable
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Use admin address from env var or placeholder for testing
const ADMIN_ADDRESS = process.env.ADMIN_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000';
const ADMIN_USERNAME = process.env.ADMIN_FARCASTER_USERNAME || 'testuser';

interface RouteTest {
  name: string;
  path: string;
  method?: 'GET' | 'POST';
  expectedStatus?: number;
  description?: string;
}

const routes: RouteTest[] = [
  // User routes
  {
    name: 'User Profile by Address',
    path: `/api/user/${ADMIN_ADDRESS}`,
    expectedStatus: 200,
    description: 'Get user profile by Ethereum address',
  },
  {
    name: 'User Profile by Username',
    path: `/api/user/${ADMIN_USERNAME}`,
    expectedStatus: 200,
    description: 'Get user profile by Farcaster username',
  },
  {
    name: 'Username by Address',
    path: `/api/user/username/${ADMIN_ADDRESS}`,
    expectedStatus: 200,
    description: 'Get username for an address',
  },
  
  // Artist routes
  {
    name: 'Artist Name Resolution',
    path: `/api/artist/${ADMIN_ADDRESS}`,
    expectedStatus: 200,
    description: 'Resolve artist name for an address',
  },
  
  // Auction routes
  {
    name: 'Active Auctions',
    path: '/api/auctions/active?first=10',
    expectedStatus: 200,
    description: 'Get active auctions',
  },
  {
    name: 'Auction by ID',
    path: '/api/auctions/1',
    expectedStatus: 200,
    description: 'Get auction by listing ID',
  },
  
  // Listing routes
  {
    name: 'Browse Listings',
    path: '/api/listings/browse?first=10',
    expectedStatus: 200,
    description: 'Browse all listings',
  },
  {
    name: 'Recently Concluded',
    path: '/api/listings/recently-concluded?first=10',
    expectedStatus: 200,
    description: 'Get recently concluded listings',
  },
  
  // User aggregation routes
  {
    name: 'Recent Artists',
    path: '/api/users/recent-artists?first=6',
    expectedStatus: 200,
    description: 'Get recent artists',
  },
  {
    name: 'Recent Bidders',
    path: '/api/users/recent-bidders?first=6',
    expectedStatus: 200,
    description: 'Get recent bidders',
  },
  {
    name: 'Recent Collectors',
    path: '/api/users/recent-collectors?first=6',
    expectedStatus: 200,
    description: 'Get recent collectors',
  },
  
  // Contract creator
  {
    name: 'Contract Creator',
    path: '/api/contract-creator/0x528fd133d6fb004faccc08b70e04186299eba176',
    expectedStatus: 200,
    description: 'Get contract creator address',
  },
  
  // Notifications (require userAddress parameter)
  {
    name: 'Notifications',
    path: `/api/notifications?userAddress=${ADMIN_ADDRESS}`,
    expectedStatus: 200,
    description: 'Get notifications for a user address',
  },
  {
    name: 'Unread Count',
    path: `/api/notifications/unread-count?userAddress=${ADMIN_ADDRESS}`,
    expectedStatus: 200,
    description: 'Get unread notification count for a user address',
  },
  
  // OpenGraph
  {
    name: 'OpenGraph Image',
    path: '/api/opengraph-image',
    expectedStatus: 200,
    description: 'Get OpenGraph image',
  },
];

interface TestResult {
  route: RouteTest;
  status: number;
  success: boolean;
  error?: string;
  responseTime: number;
}

async function testRoute(route: RouteTest): Promise<TestResult> {
  const startTime = Date.now();
  try {
    const url = `${BASE_URL}${route.path}`;
    const response = await fetch(url, {
      method: route.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const responseTime = Date.now() - startTime;
    const expectedStatus = route.expectedStatus || 200;
    const success = response.status === expectedStatus;
    
    let error: string | undefined;
    if (!success) {
      try {
        const errorData = await response.text();
        error = `Expected ${expectedStatus}, got ${response.status}. ${errorData.substring(0, 200)}`;
      } catch {
        error = `Expected ${expectedStatus}, got ${response.status}`;
      }
    }
    
    return {
      route,
      status: response.status,
      success,
      error,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      route,
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      responseTime,
    };
  }
}

async function runTests() {
  console.log(`\n🧪 Testing API Routes against ${BASE_URL}\n`);
  console.log(`Found ${routes.length} routes to test\n`);
  
  const results: TestResult[] = [];
  
  // Test routes sequentially to avoid overwhelming the server
  for (const route of routes) {
    process.stdout.write(`Testing ${route.name}... `);
    const result = await testRoute(route);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${result.status} (${result.responseTime}ms)`);
    } else {
      console.log(`❌ ${result.status} - ${result.error}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Successful: ${successful}/${routes.length}`);
  console.log(`   ❌ Failed: ${failed}/${routes.length}`);
  console.log(`   ⏱️  Average response time: ${Math.round(avgResponseTime)}ms`);
  
  if (failed > 0) {
    console.log(`\n❌ Failed Routes:`);
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`   - ${r.route.name} (${r.route.path})`);
        console.log(`     Status: ${r.status}, Error: ${r.error}`);
      });
  }
  
  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});

