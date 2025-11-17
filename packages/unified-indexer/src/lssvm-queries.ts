/**
 * GraphQL queries for LSSVM subgraph
 */

import { request, gql } from 'graphql-request';
import { Address } from 'viem';
import { SUBGRAPH_ENDPOINTS, CHAIN_IDS } from './config.js';
import type { PoolData } from './types.js';

// Subgraph endpoints by chain ID
const SUBGRAPH_ENDPOINTS_BY_CHAIN: Record<number, string> = {
  [CHAIN_IDS.BASE_MAINNET]: SUBGRAPH_ENDPOINTS.LSSVM_BASE_MAINNET,
  // Add other chains as needed
};

function getSubgraphEndpoint(chainId: number): string {
  const endpoint = SUBGRAPH_ENDPOINTS_BY_CHAIN[chainId];
  if (!endpoint) {
    throw new Error(`LSSVM subgraph endpoint not configured for chain ${chainId}`);
  }
  return endpoint;
}

// Query to get pools by NFT contract address
const POOLS_BY_NFT_QUERY = gql`
  query PoolsByNFT($nft: String!, $first: Int!, $skip: Int!) {
    pools(
      where: { nft: $nft }
      first: $first
      skip: $skip
      orderBy: createdAtTimestamp
      orderDirection: desc
    ) {
      id
      address: id
      nft
      bondingCurve
      assetRecipient
      poolType
      delta
      fee
      spotPrice
      nftIdRange {
        start
        end
      }
      tokenLiquidity
      createdAt: createdAtTimestamp
      createdAtBlock: createdAtBlockNumber
    }
  }
`;

// Query to get a single pool by ID
const POOL_BY_ID_QUERY = gql`
  query PoolById($id: ID!) {
    pool(id: $id) {
      id
      address: id
      nft
      bondingCurve
      assetRecipient
      poolType
      delta
      fee
      spotPrice
      nftIdRange {
        start
        end
      }
      tokenLiquidity
      createdAt: createdAtTimestamp
      createdAtBlock: createdAtBlockNumber
    }
  }
`;

/**
 * Query pools by NFT contract address
 */
export async function queryPoolsByNFTContract(
  chainId: number,
  nftContract: Address,
  options?: { first?: number; skip?: number }
): Promise<PoolData[]> {
  const endpoint = getSubgraphEndpoint(chainId);
  const first = options?.first ?? 100;
  const skip = options?.skip ?? 0;

  try {
    const data = await request<{ pools: PoolData[] }>(endpoint, POOLS_BY_NFT_QUERY, {
      nft: nftContract.toLowerCase(),
      first,
      skip,
    });

    return data.pools || [];
  } catch (error) {
    console.error('Error querying LSSVM subgraph for pools:', error);
    throw error;
  }
}

/**
 * Query pool details by pool address
 */
export async function queryPoolById(
  chainId: number,
  poolAddress: Address
): Promise<PoolData | null> {
  const endpoint = getSubgraphEndpoint(chainId);

  try {
    const data = await request<{ pool: PoolData | null }>(endpoint, POOL_BY_ID_QUERY, {
      id: poolAddress.toLowerCase(),
    });

    return data.pool;
  } catch (error) {
    console.error('Error querying LSSVM subgraph for pool:', error);
    throw error;
  }
}

/**
 * @deprecated Use queryPoolById instead
 */
export async function queryPoolDetails(
  poolAddress: string,
  chainId: number = CHAIN_IDS.BASE_MAINNET
): Promise<PoolData | null> {
  return queryPoolById(chainId, poolAddress as Address);
}
