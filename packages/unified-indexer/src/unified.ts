/**
 * Unified query functions combining LSSVM and Auctionhouse data
 */

import { Address } from 'viem';
import { queryPoolsByNFTContract, queryPoolById } from './lssvm-queries.js';
import { queryListingsByTokenAddress, queryListingById } from './auctionhouse-queries.js';
import type { PoolData, AuctionData, SalesOptions, CollectionSales } from './types.js';

/**
 * Get all sales (pools + auctions) for a collection
 * This is for display/browsing purposes only, not for creation options
 */
export async function getSalesForCollection(
  nftContract: Address,
  chainId: number,
  options?: { first?: number; skip?: number }
): Promise<CollectionSales> {
  try {
    // Query both pools and auctions in parallel
    const [pools, auctions] = await Promise.all([
      queryPoolsByNFTContract(chainId, nftContract, options).catch((error: unknown) => {
        console.error('Error fetching pools:', error);
        return [] as PoolData[];
      }),
      queryListingsByTokenAddress(chainId, nftContract, options).catch((error: unknown) => {
        console.error('Error fetching auctions:', error);
        return [] as AuctionData[];
      }),
    ]);

    return {
      pools,
      auctions,
    };
  } catch (error) {
    console.error('Error fetching sales for collection:', error);
    throw error;
  }
}

/**
 * Get pool data by pool address
 */
export async function getPoolData(
  poolAddress: Address,
  chainId: number
): Promise<PoolData | null> {
  try {
    return await queryPoolById(chainId, poolAddress);
  } catch (error) {
    console.error('Error fetching pool data:', error);
    return null;
  }
}

/**
 * Get auction data by listing ID
 */
export async function getAuctionData(
  listingId: string,
  chainId: number
): Promise<AuctionData | null> {
  try {
    return await queryListingById(chainId, listingId);
  } catch (error) {
    console.error('Error fetching auction data:', error);
    return null;
  }
}

/**
 * @deprecated Use getSalesForCollection instead
 * Get unified sales options for an NFT contract
 * Queries both LSSVM pools and Auctionhouse listings
 */
export async function getSalesOptions(
  nftContract: string,
  chainId: number = 8453
): Promise<SalesOptions> {
  const sales = await getSalesForCollection(nftContract as Address, chainId);
  
  return {
    collectionAddress: nftContract,
    chainId,
    pools: sales.pools,
    auctions: sales.auctions,
    hasPools: sales.pools.length > 0,
    hasAuctions: sales.auctions.length > 0,
    hasAnySales: sales.pools.length > 0 || sales.auctions.length > 0,
  };
}

