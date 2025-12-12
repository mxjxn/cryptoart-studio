import { request, gql } from 'graphql-request';
import { getDatabase, userStats, eq, type TokenStats, type UserStatsData } from '@cryptoart/db';

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
export async function calculateUserStats(userAddress: string): Promise<Omit<UserStatsData, 'id'>> {
  const normalizedAddress = userAddress.toLowerCase();
  
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
export async function saveUserStats(stats: Omit<UserStatsData, 'id'>): Promise<void> {
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
