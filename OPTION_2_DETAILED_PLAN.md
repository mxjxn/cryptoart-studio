# Option 2: Cached User Stats - Detailed Implementation Plan

## Overview

This document provides a comprehensive, step-by-step plan for implementing cached user statistics using a dedicated database table. This approach pre-calculates and stores user stats, providing fast access while supporting historical tracking and trend analysis.

## Architecture

### High-Level Design

```
┌─────────────────┐
│  Smart Contract │
│     Events      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Subgraph     │  ← Indexes on-chain events
│   (Read-only)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Cron Job       │  ← Queries subgraph periodically
│  (Daily/Hourly) │     Calculates aggregated stats
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  userStats      │  ← Caches calculated stats
│  Database Table │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Endpoint   │  ← Fast lookup from cache
│  /api/user/     │
│  [id]/stats     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Profile   │  ← Displays stats instantly
│     Page        │
└─────────────────┘
```

## Phase 1: Database Schema Design

### 1.1 Create User Stats Table

**File:** `packages/db/src/schema.ts`

Add the following schema definition:

```typescript
/**
 * User statistics table - Cache pre-calculated user stats
 * Updated periodically by cron job from subgraph data
 */
export const userStats = pgTable('user_stats', {
  id: uuid('id').defaultRandom().primaryKey(),
  userAddress: text('user_address').notNull().unique(), // Lowercase ETH address
  
  // Sales Statistics (as seller)
  totalArtworksSold: integer('total_artworks_sold').notNull().default(0),
  totalSalesVolumeWei: text('total_sales_volume_wei').notNull().default('0'), // Total ETH received
  totalSalesCount: integer('total_sales_count').notNull().default(0), // Total number of sales
  uniqueBuyers: integer('unique_buyers').notNull().default(0), // Number of unique buyers
  tokensSoldIn: jsonb('tokens_sold_in'), // Array of {address, symbol, count, totalAmount}
  
  // Purchase Statistics (as buyer)
  totalArtworksPurchased: integer('total_artworks_purchased').notNull().default(0),
  totalPurchaseVolumeWei: text('total_purchase_volume_wei').notNull().default('0'), // Total ETH spent
  totalPurchaseCount: integer('total_purchase_count').notNull().default(0), // Total number of purchases
  uniqueSellers: integer('unique_sellers').notNull().default(0), // Number of unique sellers
  tokensBoughtIn: jsonb('tokens_bought_in'), // Array of {address, symbol, count, totalAmount}
  
  // Bidding Statistics
  totalBidsPlaced: integer('total_bids_placed').notNull().default(0),
  totalBidsWon: integer('total_bids_won').notNull().default(0), // Bids that resulted in purchase
  totalBidVolumeWei: text('total_bid_volume_wei').notNull().default('0'), // Sum of all bid amounts
  activeBids: integer('active_bids').notNull().default(0), // Current active bids
  
  // Offer Statistics
  totalOffersMade: integer('total_offers_made').notNull().default(0),
  totalOffersReceived: integer('total_offers_received').notNull().default(0),
  offersAccepted: integer('offers_accepted').notNull().default(0),
  offersRescinded: integer('offers_rescinded').notNull().default(0),
  
  // Listing Statistics (as seller)
  activeListings: integer('active_listings').notNull().default(0),
  totalListingsCreated: integer('total_listings_created').notNull().default(0),
  cancelledListings: integer('cancelled_listings').notNull().default(0),
  
  // Time-based metrics
  firstSaleDate: timestamp('first_sale_date'),
  lastSaleDate: timestamp('last_sale_date'),
  firstPurchaseDate: timestamp('first_purchase_date'),
  lastPurchaseDate: timestamp('last_purchase_date'),
  
  // Metadata
  calculatedAt: timestamp('calculated_at').notNull(), // When stats were last calculated
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userAddressIdx: index('user_stats_user_address_idx').on(table.userAddress),
  calculatedAtIdx: index('user_stats_calculated_at_idx').on(table.calculatedAt),
}));

export interface UserStatsData {
  id: string;
  userAddress: string;
  // Sales stats
  totalArtworksSold: number;
  totalSalesVolumeWei: string;
  totalSalesCount: number;
  uniqueBuyers: number;
  tokensSoldIn?: TokenStats[] | null;
  // Purchase stats
  totalArtworksPurchased: number;
  totalPurchaseVolumeWei: string;
  totalPurchaseCount: number;
  uniqueSellers: number;
  tokensBoughtIn?: TokenStats[] | null;
  // Bidding stats
  totalBidsPlaced: number;
  totalBidsWon: number;
  totalBidVolumeWei: string;
  activeBids: number;
  // Offer stats
  totalOffersMade: number;
  totalOffersReceived: number;
  offersAccepted: number;
  offersRescinded: number;
  // Listing stats
  activeListings: number;
  totalListingsCreated: number;
  cancelledListings: number;
  // Time metrics
  firstSaleDate?: Date | null;
  lastSaleDate?: Date | null;
  firstPurchaseDate?: Date | null;
  lastPurchaseDate?: Date | null;
  // Metadata
  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenStats {
  address: string; // '0x0000...' for ETH
  symbol: string; // 'ETH' or token symbol
  count: number; // Number of transactions
  totalAmount: string; // Total amount in wei
}
```

### 1.2 Create Migration

**File:** `packages/db/migrations/XXXX_add_user_stats_table.sql`

```sql
-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL UNIQUE,
  
  -- Sales statistics
  total_artworks_sold INTEGER NOT NULL DEFAULT 0,
  total_sales_volume_wei TEXT NOT NULL DEFAULT '0',
  total_sales_count INTEGER NOT NULL DEFAULT 0,
  unique_buyers INTEGER NOT NULL DEFAULT 0,
  tokens_sold_in JSONB,
  
  -- Purchase statistics
  total_artworks_purchased INTEGER NOT NULL DEFAULT 0,
  total_purchase_volume_wei TEXT NOT NULL DEFAULT '0',
  total_purchase_count INTEGER NOT NULL DEFAULT 0,
  unique_sellers INTEGER NOT NULL DEFAULT 0,
  tokens_bought_in JSONB,
  
  -- Bidding statistics
  total_bids_placed INTEGER NOT NULL DEFAULT 0,
  total_bids_won INTEGER NOT NULL DEFAULT 0,
  total_bid_volume_wei TEXT NOT NULL DEFAULT '0',
  active_bids INTEGER NOT NULL DEFAULT 0,
  
  -- Offer statistics
  total_offers_made INTEGER NOT NULL DEFAULT 0,
  total_offers_received INTEGER NOT NULL DEFAULT 0,
  offers_accepted INTEGER NOT NULL DEFAULT 0,
  offers_rescinded INTEGER NOT NULL DEFAULT 0,
  
  -- Listing statistics
  active_listings INTEGER NOT NULL DEFAULT 0,
  total_listings_created INTEGER NOT NULL DEFAULT 0,
  cancelled_listings INTEGER NOT NULL DEFAULT 0,
  
  -- Time-based metrics
  first_sale_date TIMESTAMP,
  last_sale_date TIMESTAMP,
  first_purchase_date TIMESTAMP,
  last_purchase_date TIMESTAMP,
  
  -- Metadata
  calculated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX user_stats_user_address_idx ON user_stats(user_address);
CREATE INDEX user_stats_calculated_at_idx ON user_stats(calculated_at);

-- Add comment
COMMENT ON TABLE user_stats IS 'Cached user statistics calculated from subgraph data';
```

## Phase 2: Stats Calculation Logic

### 2.1 Create Stats Calculator Service

**File:** `apps/mvp/src/lib/server/user-stats-calculator.ts`

```typescript
import { request, gql } from 'graphql-request';
import { getDatabase, userStats, eq } from '@cryptoart/db';
import type { TokenStats, UserStatsData } from '@cryptoart/db';

const getSubgraphEndpoint = (): string => {
  const endpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (!endpoint) {
    throw new Error('Subgraph endpoint not configured');
  }
  return endpoint;
};

const getSubgraphHeaders = (): Record<string, string> => {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}` };
  }
  return {};
};

// GraphQL queries
const USER_PURCHASES_QUERY = gql`
  query UserPurchases($buyer: String!, $first: Int!, $skip: Int!) {
    purchases(
      where: { buyer: $buyer }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      amount
      count
      timestamp
      listing {
        seller
        erc20
        tokenAddress
        tokenId
      }
    }
  }
`;

const USER_SALES_QUERY = gql`
  query UserSales($seller: String!, $first: Int!, $skip: Int!) {
    purchases(
      where: { listing_: { seller: $seller } }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      amount
      count
      buyer
      timestamp
      listing {
        erc20
        tokenAddress
        tokenId
      }
    }
  }
`;

const USER_BIDS_QUERY = gql`
  query UserBids($bidder: String!, $first: Int!, $skip: Int!) {
    bids(
      where: { bidder: $bidder }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      amount
      timestamp
      listing {
        id
        listingId
        erc20
        status
        finalized
      }
    }
  }
`;

const USER_OFFERS_QUERY = gql`
  query UserOffers($offerer: String!, $first: Int!, $skip: Int!) {
    offers(
      where: { offerer: $offerer }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      amount
      status
      timestamp
      listing {
        erc20
      }
    }
  }
`;

const USER_OFFERS_RECEIVED_QUERY = gql`
  query UserOffersReceived($seller: String!, $first: Int!, $skip: Int!) {
    offers(
      where: { listing_: { seller: $seller } }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      status
    }
  }
`;

const USER_LISTINGS_QUERY = gql`
  query UserListings($seller: String!, $first: Int!, $skip: Int!) {
    listings(
      where: { seller: $seller }
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      listingId
      status
      listingType
      createdAt
    }
  }
`;

/**
 * Paginate through all results from a query
 */
async function paginateQuery<T>(
  query: string,
  variables: Record<string, any>,
  dataKey: string
): Promise<T[]> {
  const endpoint = getSubgraphEndpoint();
  const headers = getSubgraphHeaders();
  const results: T[] = [];
  let skip = 0;
  const first = 1000; // Max per page
  
  while (true) {
    const data = await request<Record<string, T[]>>(
      endpoint,
      query,
      { ...variables, first, skip },
      headers
    );
    
    const items = data[dataKey] || [];
    results.push(...items);
    
    if (items.length < first) {
      break; // No more results
    }
    
    skip += first;
  }
  
  return results;
}

/**
 * Aggregate token stats from transactions
 */
function aggregateTokenStats(
  transactions: Array<{ amount: string; listing?: { erc20?: string } }>
): TokenStats[] {
  const tokenMap = new Map<string, { count: number; totalAmount: bigint }>();
  
  for (const tx of transactions) {
    const tokenAddress = (tx.listing?.erc20 || '0x0000000000000000000000000000000000000000').toLowerCase();
    const amount = BigInt(tx.amount);
    
    const existing = tokenMap.get(tokenAddress);
    if (existing) {
      existing.count++;
      existing.totalAmount += amount;
    } else {
      tokenMap.set(tokenAddress, { count: 1, totalAmount: amount });
    }
  }
  
  return Array.from(tokenMap.entries()).map(([address, { count, totalAmount }]) => ({
    address,
    symbol: address === '0x0000000000000000000000000000000000000000' ? 'ETH' : 'ERC20',
    count,
    totalAmount: totalAmount.toString(),
  }));
}

/**
 * Calculate stats for a single user
 */
export async function calculateUserStats(userAddress: string): Promise<UserStatsData> {
  const normalizedAddress = userAddress.toLowerCase();
  const endpoint = getSubgraphEndpoint();
  
  console.log(`[UserStats] Calculating stats for ${normalizedAddress}`);
  
  // Fetch all data in parallel
  const [purchases, sales, bids, offersMade, offersReceived, listings] = await Promise.all([
    paginateQuery<any>(USER_PURCHASES_QUERY, { buyer: normalizedAddress }, 'purchases'),
    paginateQuery<any>(USER_SALES_QUERY, { seller: normalizedAddress }, 'purchases'),
    paginateQuery<any>(USER_BIDS_QUERY, { bidder: normalizedAddress }, 'bids'),
    paginateQuery<any>(USER_OFFERS_QUERY, { offerer: normalizedAddress }, 'offers'),
    paginateQuery<any>(USER_OFFERS_RECEIVED_QUERY, { seller: normalizedAddress }, 'offers'),
    paginateQuery<any>(USER_LISTINGS_QUERY, { seller: normalizedAddress }, 'listings'),
  ]);
  
  console.log(`[UserStats] Fetched data: ${purchases.length} purchases, ${sales.length} sales, ${bids.length} bids`);
  
  // Calculate purchase stats
  const totalPurchaseVolumeWei = purchases.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
  const uniqueSellers = new Set(sales.map((s: any) => s.buyer?.toLowerCase())).size;
  const tokensBoughtIn = aggregateTokenStats(purchases);
  
  const purchaseDates = purchases.map((p: any) => new Date(Number(p.timestamp) * 1000));
  const firstPurchaseDate = purchaseDates.length > 0 
    ? new Date(Math.min(...purchaseDates.map(d => d.getTime())))
    : null;
  const lastPurchaseDate = purchaseDates.length > 0
    ? new Date(Math.max(...purchaseDates.map(d => d.getTime())))
    : null;
  
  // Calculate sales stats
  const totalSalesVolumeWei = sales.reduce((sum, s) => sum + BigInt(s.amount), BigInt(0));
  const uniqueBuyers = new Set(sales.map((s: any) => s.buyer?.toLowerCase())).size;
  const tokensSoldIn = aggregateTokenStats(sales);
  
  const saleDates = sales.map((s: any) => new Date(Number(s.timestamp) * 1000));
  const firstSaleDate = saleDates.length > 0
    ? new Date(Math.min(...saleDates.map(d => d.getTime())))
    : null;
  const lastSaleDate = saleDates.length > 0
    ? new Date(Math.max(...saleDates.map(d => d.getTime())))
    : null;
  
  // Calculate bidding stats
  const totalBidVolumeWei = bids.reduce((sum, b) => sum + BigInt(b.amount), BigInt(0));
  const bidsWon = bids.filter((b: any) => b.listing?.finalized && b.listing?.status === 'FINALIZED').length;
  const activeBids = bids.filter((b: any) => 
    !b.listing?.finalized && b.listing?.status === 'ACTIVE'
  ).length;
  
  // Calculate offer stats
  const offersAccepted = offersMade.filter((o: any) => o.status === 'ACCEPTED').length;
  const offersRescinded = offersMade.filter((o: any) => o.status === 'RESCINDED').length;
  const offersReceivedAccepted = offersReceived.filter((o: any) => o.status === 'ACCEPTED').length;
  
  // Calculate listing stats
  const activeListings = listings.filter((l: any) => l.status === 'ACTIVE').length;
  const cancelledListings = listings.filter((l: any) => l.status === 'CANCELLED').length;
  
  const now = new Date();
  
  return {
    id: '', // Will be generated by database
    userAddress: normalizedAddress,
    // Sales stats
    totalArtworksSold: sales.length,
    totalSalesVolumeWei: totalSalesVolumeWei.toString(),
    totalSalesCount: sales.reduce((sum, s) => sum + Number(s.count), 0),
    uniqueBuyers,
    tokensSoldIn,
    // Purchase stats
    totalArtworksPurchased: purchases.length,
    totalPurchaseVolumeWei: totalPurchaseVolumeWei.toString(),
    totalPurchaseCount: purchases.reduce((sum, p) => sum + Number(p.count), 0),
    uniqueSellers,
    tokensBoughtIn,
    // Bidding stats
    totalBidsPlaced: bids.length,
    totalBidsWon: bidsWon,
    totalBidVolumeWei: totalBidVolumeWei.toString(),
    activeBids,
    // Offer stats
    totalOffersMade: offersMade.length,
    totalOffersReceived: offersReceived.length,
    offersAccepted,
    offersRescinded,
    // Listing stats
    activeListings,
    totalListingsCreated: listings.length,
    cancelledListings,
    // Time metrics
    firstSaleDate,
    lastSaleDate,
    firstPurchaseDate,
    lastPurchaseDate,
    // Metadata
    calculatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Save or update user stats in database
 */
export async function saveUserStats(stats: UserStatsData): Promise<void> {
  const db = getDatabase();
  
  // Check if stats already exist
  const [existing] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userAddress, stats.userAddress))
    .limit(1);
  
  if (existing) {
    // Update existing
    await db
      .update(userStats)
      .set({
        ...stats,
        updatedAt: new Date(),
      })
      .where(eq(userStats.userAddress, stats.userAddress));
    
    console.log(`[UserStats] Updated stats for ${stats.userAddress}`);
  } else {
    // Insert new
    await db.insert(userStats).values(stats);
    console.log(`[UserStats] Created stats for ${stats.userAddress}`);
  }
}
```

## Phase 3: Cron Job Implementation

### 3.1 Create Cron Route

**File:** `apps/mvp/src/app/api/cron/calculate-user-stats/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, userCache } from '@cryptoart/db';
import { calculateUserStats, saveUserStats } from '~/lib/server/user-stats-calculator';

/**
 * GET /api/cron/calculate-user-stats
 * Calculate and cache user statistics for all users
 * 
 * Query params:
 * - address: Optional specific user address to calculate
 * - batch: Batch size for processing (default: 100)
 * - offset: Offset for pagination (default: 0)
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const specificAddress = searchParams.get('address');
    const batchSize = parseInt(searchParams.get('batch') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const db = getDatabase();
    const startTime = Date.now();
    
    // If specific address provided, calculate only for that user
    if (specificAddress) {
      console.log(`[Cron] Calculating stats for specific user: ${specificAddress}`);
      const stats = await calculateUserStats(specificAddress);
      await saveUserStats(stats);
      
      return NextResponse.json({
        success: true,
        message: 'Stats calculated for user',
        userAddress: specificAddress,
        duration: Date.now() - startTime,
      });
    }
    
    // Otherwise, process batch of users from userCache
    const users = await db
      .select({ ethAddress: userCache.ethAddress })
      .from(userCache)
      .limit(batchSize)
      .offset(offset);
    
    console.log(`[Cron] Processing batch of ${users.length} users (offset: ${offset})`);
    
    const results = {
      total: users.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ address: string; error: string }>,
    };
    
    // Process users in parallel (batches of 10 to avoid overwhelming the subgraph)
    const chunks = [];
    for (let i = 0; i < users.length; i += 10) {
      chunks.push(users.slice(i, i + 10));
    }
    
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (user) => {
          try {
            const stats = await calculateUserStats(user.ethAddress);
            await saveUserStats(stats);
            results.successful++;
          } catch (error) {
            console.error(`[Cron] Error calculating stats for ${user.ethAddress}:`, error);
            results.failed++;
            results.errors.push({
              address: user.ethAddress,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })
      );
    }
    
    const duration = Date.now() - startTime;
    console.log(`[Cron] Batch complete: ${results.successful} successful, ${results.failed} failed in ${duration}ms`);
    
    return NextResponse.json({
      success: true,
      message: 'User stats calculated',
      results,
      duration,
      nextOffset: offset + batchSize,
    });
  } catch (error) {
    console.error('[Cron] Error in calculate-user-stats:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate user stats',
      },
      { status: 500 }
    );
  }
}
```

### 3.2 Configure Vercel Cron

**File:** `vercel.json` (add to existing config)

```json
{
  "crons": [
    {
      "path": "/api/cron/calculate-stats",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/calculate-user-stats",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

This runs the user stats calculation every 6 hours.

### 3.3 Create Management Script

**File:** `packages/db/scripts/backfill-user-stats.ts`

```typescript
#!/usr/bin/env tsx

/**
 * Backfill user stats for all existing users
 * Run with: pnpm --filter @cryptoart/db backfill-user-stats
 */

import { getDatabase, userCache } from '../src/index';

async function backfillUserStats() {
  const db = getDatabase();
  
  console.log('[Backfill] Starting user stats backfill...');
  
  // Get total count
  const [{ count }] = await db
    .select({ count: sql`count(*)` })
    .from(userCache);
  
  console.log(`[Backfill] Total users to process: ${count}`);
  
  const batchSize = 100;
  let offset = 0;
  let totalProcessed = 0;
  
  while (offset < Number(count)) {
    console.log(`[Backfill] Processing batch at offset ${offset}...`);
    
    try {
      // Call the cron endpoint with batch parameters
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/cron/calculate-user-stats?batch=${batchSize}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`[Backfill] Batch result:`, result.results);
      
      totalProcessed += result.results.successful;
      offset += batchSize;
      
      // Rate limiting: wait 2 seconds between batches
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`[Backfill] Error processing batch at offset ${offset}:`, error);
      // Continue with next batch
      offset += batchSize;
    }
  }
  
  console.log(`[Backfill] Complete! Processed ${totalProcessed} users`);
}

backfillUserStats().catch(console.error);
```

## Phase 4: API Endpoint

### 4.1 Create Stats API Endpoint

**File:** `apps/mvp/src/app/api/user/[identifier]/stats/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, userStats, eq } from '@cryptoart/db';
import { resolveUserAddresses } from '../../route';

/**
 * GET /api/user/[identifier]/stats
 * Get cached user statistics
 * Falls back to calculating on-demand if not cached
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params;
    
    if (!identifier) {
      return NextResponse.json(
        { error: 'Username or address is required' },
        { status: 400 }
      );
    }
    
    // Resolve identifier to address
    // Reuse the resolveUserAddresses function from the parent route
    const { primaryAddress } = await resolveUserAddresses(identifier);
    
    if (!primaryAddress) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const db = getDatabase();
    
    // Try to get cached stats
    const [cachedStats] = await db
      .select()
      .from(userStats)
      .where(eq(userStats.userAddress, primaryAddress.toLowerCase()))
      .limit(1);
    
    if (cachedStats) {
      // Check if stats are stale (older than 24 hours)
      const age = Date.now() - new Date(cachedStats.calculatedAt).getTime();
      const isStale = age > 24 * 60 * 60 * 1000;
      
      return NextResponse.json({
        success: true,
        stats: cachedStats,
        cached: true,
        stale: isStale,
        calculatedAt: cachedStats.calculatedAt,
      }, {
        headers: {
          // Cache for 1 hour, allow stale for 2 hours while revalidating
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      });
    }
    
    // No cached stats - trigger async calculation and return empty stats
    // The cron job will calculate proper stats
    return NextResponse.json({
      success: true,
      stats: {
        userAddress: primaryAddress.toLowerCase(),
        totalArtworksSold: 0,
        totalSalesVolumeWei: '0',
        totalArtworksPurchased: 0,
        totalPurchaseVolumeWei: '0',
        // ... other zero values
      },
      cached: false,
      message: 'Stats not yet calculated. They will be available after the next update cycle.',
    }, {
      status: 202, // Accepted - processing will happen async
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[API] Error fetching user stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user stats',
      },
      { status: 500 }
    );
  }
}
```

## Phase 5: UI Implementation

### 5.1 Update User Profile Client

**File:** `apps/mvp/src/app/user/[username]/UserProfileClient.tsx`

Add a new "Stats" tab and fetch stats data:

```typescript
// Add to imports
import { useQuery } from '@tanstack/react-query';
import { formatEther } from 'viem';

// Add to UserProfileClient component
const [activeTab, setActiveTab] = useState<'wallets' | 'artworks' | 'listings' | 'collections' | 'galleries' | 'stats'>('wallets');

// Add stats query
const { data: statsData, isLoading: isLoadingStats } = useQuery({
  queryKey: ['user-stats', profileData?.primaryAddress],
  queryFn: () => 
    fetch(`/api/user/${profileData?.primaryAddress}/stats`).then(r => r.json()),
  enabled: !!profileData?.primaryAddress && activeTab === 'stats',
});

// Add stats tab button
<button
  onClick={() => setActiveTab('stats')}
  className={`pb-2 px-2 text-sm ${
    activeTab === 'stats'
      ? 'border-b-2 border-white text-white'
      : 'text-[#999999] hover:text-[#cccccc]'
  }`}
>
  Stats
</button>

// Add stats tab content
{activeTab === 'stats' && (
  <div className="space-y-6">
    {isLoadingStats ? (
      <p className="text-[#999999]">Loading stats...</p>
    ) : !statsData?.stats ? (
      <p className="text-[#999999]">No stats available yet</p>
    ) : (
      <>
        {/* Sales Stats */}
        <div>
          <h2 className="text-lg font-light mb-4">Sales</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
              <p className="text-sm text-[#999999]">Artworks Sold</p>
              <p className="text-2xl font-semibold">{statsData.stats.totalArtworksSold}</p>
            </div>
            <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
              <p className="text-sm text-[#999999]">Total Volume</p>
              <p className="text-xl font-semibold">
                {formatEther(BigInt(statsData.stats.totalSalesVolumeWei))} ETH
              </p>
            </div>
            <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
              <p className="text-sm text-[#999999]">Unique Buyers</p>
              <p className="text-2xl font-semibold">{statsData.stats.uniqueBuyers}</p>
            </div>
            <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
              <p className="text-sm text-[#999999]">Total Sales</p>
              <p className="text-2xl font-semibold">{statsData.stats.totalSalesCount}</p>
            </div>
          </div>
        </div>
        
        {/* Purchase Stats */}
        <div>
          <h2 className="text-lg font-light mb-4">Purchases</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
              <p className="text-sm text-[#999999]">Artworks Purchased</p>
              <p className="text-2xl font-semibold">{statsData.stats.totalArtworksPurchased}</p>
            </div>
            <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
              <p className="text-sm text-[#999999]">Total Spent</p>
              <p className="text-xl font-semibold">
                {formatEther(BigInt(statsData.stats.totalPurchaseVolumeWei))} ETH
              </p>
            </div>
            <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
              <p className="text-sm text-[#999999]">Unique Sellers</p>
              <p className="text-2xl font-semibold">{statsData.stats.uniqueSellers}</p>
            </div>
            <div className="p-4 bg-[#1a1a1a] border border-[#333333]">
              <p className="text-sm text-[#999999]">Total Purchases</p>
              <p className="text-2xl font-semibold">{statsData.stats.totalPurchaseCount}</p>
            </div>
          </div>
        </div>
        
        {/* Token Breakdown */}
        {statsData.stats.tokensSoldIn && statsData.stats.tokensSoldIn.length > 0 && (
          <div>
            <h2 className="text-lg font-light mb-4">Tokens Sold In</h2>
            <div className="space-y-2">
              {statsData.stats.tokensSoldIn.map((token: any) => (
                <div key={token.address} className="flex justify-between p-3 bg-[#1a1a1a] border border-[#333333]">
                  <span className="text-sm">{token.symbol}</span>
                  <span className="text-sm font-medium">
                    {formatEther(BigInt(token.totalAmount))} ({token.count} sales)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )}
  </div>
)}
```

### 5.2 Add Stats to Admin Panel (Optional)

**File:** `apps/mvp/src/app/admin/users/page.tsx`

Add a stats column or expandable section showing user stats summary.

## Phase 6: Testing & Deployment

### 6.1 Testing Checklist

- [ ] Unit tests for `calculateUserStats` function
- [ ] Integration tests for cron endpoint
- [ ] Test with users who have:
  - No transactions
  - Only purchases
  - Only sales
  - Both purchases and sales
  - Multiple token types (ETH + ERC20)
  - Multiple verified wallets (Farcaster users)
- [ ] Test pagination in backfill script
- [ ] Verify database indexes are used (EXPLAIN queries)
- [ ] Load testing for stats API endpoint
- [ ] Verify cron job doesn't timeout on Vercel

### 6.2 Deployment Steps

1. **Database Migration**
   ```bash
   # Generate migration
   cd packages/db
   pnpm drizzle-kit generate:pg
   
   # Apply migration to production
   pnpm migrate:production
   ```

2. **Deploy Application**
   ```bash
   # Deploy to Vercel
   vercel --prod
   ```

3. **Run Backfill**
   ```bash
   # Start backfill process
   pnpm --filter @cryptoart/db backfill-user-stats
   ```

4. **Monitor Cron Jobs**
   - Check Vercel cron logs
   - Verify stats are being updated
   - Monitor database table size

### 6.3 Monitoring

- Set up alerts for cron job failures
- Monitor subgraph query performance
- Track database table growth
- Monitor API response times

## Phase 7: Optimization & Enhancements

### 7.1 Performance Optimizations

1. **Add materialized views** for complex queries
2. **Implement Redis caching** for frequently accessed stats
3. **Add database triggers** to update stats on new purchases (real-time)
4. **Optimize subgraph queries** with better filters and pagination

### 7.2 Feature Enhancements

1. **Historical trends**
   - Store daily snapshots in separate table
   - Add charts showing volume over time
   
2. **Leaderboards**
   - Top sellers by volume
   - Top collectors by count
   - Most active traders
   
3. **Comparisons**
   - Compare user stats to platform averages
   - Percentile rankings
   
4. **Export functionality**
   - CSV export of transaction history
   - Tax reporting support

## Estimated Timeline

| Phase | Description | Duration |
|-------|-------------|----------|
| 1 | Database schema design | 4 hours |
| 2 | Stats calculation logic | 8 hours |
| 3 | Cron job implementation | 6 hours |
| 4 | API endpoint | 3 hours |
| 5 | UI implementation | 6 hours |
| 6 | Testing & deployment | 8 hours |
| **Total** | **End-to-end implementation** | **~5 days** |

## Cost Considerations

- **Database storage**: ~1KB per user * number of users
- **Subgraph queries**: Rate limits and costs from The Graph
- **Vercel cron**: Included in Pro plan
- **Compute time**: ~100-500ms per user calculation

## Conclusion

Option 2 provides a robust, scalable solution for user stats with the following benefits:

✅ Fast page loads (cached data)
✅ Historical tracking capability
✅ Reduced subgraph load
✅ Support for advanced analytics
✅ Better performance at scale

The implementation is more complex than Option 1 but provides significant advantages for a production system with many users.
