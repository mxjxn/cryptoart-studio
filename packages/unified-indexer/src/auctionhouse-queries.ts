import { request, gql } from 'graphql-request'
import { Address } from 'viem'
import type { AuctionData } from './types.js'

// Subgraph endpoints - TODO: Update with actual auctionhouse subgraph endpoint
const SUBGRAPH_ENDPOINTS = {
  8453: '', // Base Mainnet - To be configured
  // Add other chains as needed
} as const

function getSubgraphEndpoint(chainId: number): string {
  const endpoint = SUBGRAPH_ENDPOINTS[chainId as keyof typeof SUBGRAPH_ENDPOINTS]
  if (!endpoint) {
    throw new Error(`Auctionhouse subgraph endpoint not configured for chain ${chainId}`)
  }
  return endpoint
}

// Query to get listings by NFT contract address
const LISTINGS_BY_TOKEN_ADDRESS_QUERY = gql`
  query ListingsByTokenAddress($tokenAddress: Bytes!, $first: Int!, $skip: Int!) {
    listings(
      where: { tokenAddress: $tokenAddress, status: "ACTIVE" }
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      listingId
      marketplace
      seller
      tokenAddress
      tokenId
      tokenSpec
      listingType
      initialAmount
      totalAvailable
      totalPerSale
      startTime
      endTime
      lazy
      status
      totalSold
      currentPrice
      createdAt
      createdAtBlock
      finalizedAt
    }
  }
`

// Query to get a single listing by ID
const LISTING_BY_ID_QUERY = gql`
  query ListingById($id: ID!) {
    listing(id: $id) {
      id
      listingId
      marketplace
      seller
      tokenAddress
      tokenId
      tokenSpec
      listingType
      initialAmount
      totalAvailable
      totalPerSale
      startTime
      endTime
      lazy
      status
      totalSold
      currentPrice
      createdAt
      createdAtBlock
      finalizedAt
    }
  }
`

/**
 * Query listings for a given NFT contract address
 */
export async function queryListingsByTokenAddress(
  chainId: number,
  tokenAddress: Address,
  options?: { first?: number; skip?: number }
): Promise<AuctionData[]> {
  const endpoint = getSubgraphEndpoint(chainId)
  const first = options?.first ?? 100
  const skip = options?.skip ?? 0

  try {
    const data = await request<{ listings: AuctionData[] }>(endpoint, LISTINGS_BY_TOKEN_ADDRESS_QUERY, {
      tokenAddress: tokenAddress.toLowerCase(),
      first,
      skip,
    })
    return data.listings
  } catch (error) {
    console.error('Error querying auctionhouse subgraph for listings:', error)
    throw error
  }
}

/**
 * Query a single listing by its ID
 */
export async function queryListingById(chainId: number, listingId: string): Promise<AuctionData | null> {
  const endpoint = getSubgraphEndpoint(chainId)

  try {
    const data = await request<{ listing: AuctionData | null }>(endpoint, LISTING_BY_ID_QUERY, {
      id: listingId,
    })
    return data.listing
  } catch (error) {
    console.error('Error querying auctionhouse subgraph for listing:', error)
    throw error
  }
}
