/**
 * Thin marketplace adapter for studio create flows.
 * Pulls addresses/ABI from @cryptoart/marketplace and adds Base Sepolia
 * until those PRs merge into the relaunch branch.
 */

import {
  MARKETPLACE_ABI,
  BASE_MARKETPLACE_ADDRESS,
  ETHEREUM_MARKETPLACE_ADDRESS,
  BASE_CHAIN_ID,
  ETHEREUM_CHAIN_ID,
} from '@cryptoart/marketplace';
import { encodeFunctionData, type Address, type Hex } from 'viem';

export { MARKETPLACE_ABI };

/** Base Sepolia auction house (from chain-indexer / PR 199). */
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_MARKETPLACE_ADDRESS =
  '0xfd35bF63448595377d5bc2fCB435239Ba2AFB3ea' as const;

export const SUPPORTED_STUDIO_CHAINS = [
  BASE_SEPOLIA_CHAIN_ID,
  BASE_CHAIN_ID,
  ETHEREUM_CHAIN_ID,
] as const;

export type StudioChainId = (typeof SUPPORTED_STUDIO_CHAINS)[number];

export function isSupportedStudioChain(chainId: number): chainId is StudioChainId {
  return (SUPPORTED_STUDIO_CHAINS as readonly number[]).includes(chainId);
}

export function studioMarketplaceAddress(chainId: number): Address {
  if (chainId === ETHEREUM_CHAIN_ID) return ETHEREUM_MARKETPLACE_ADDRESS;
  if (chainId === BASE_CHAIN_ID) return BASE_MARKETPLACE_ADDRESS;
  if (chainId === BASE_SEPOLIA_CHAIN_ID) return BASE_SEPOLIA_MARKETPLACE_ADDRESS;
  throw new Error(`Unsupported marketplace chain ${chainId}`);
}

export function studioChainLabel(chainId: number): string {
  if (chainId === ETHEREUM_CHAIN_ID) return 'Ethereum';
  if (chainId === BASE_CHAIN_ID) return 'Base';
  if (chainId === BASE_SEPOLIA_CHAIN_ID) return 'Base Sepolia';
  return `Chain ${chainId}`;
}

/** Auction house TokenSpec enum. */
export const TokenSpec = {
  ERC721: 1,
  ERC1155: 2,
} as const;

/** Auction house ListingType enum (fixed price = 1 is typical for lazy drops). */
export const ListingType = {
  INDIVIDUAL_AUCTION: 0,
  FIXED_PRICE: 1,
  DYNAMIC_PRICE: 2,
  RANKED_AUCTION: 3,
} as const;

export type CreateLazyListingParams = {
  priceWei: bigint;
  totalAvailable: number;
  totalPerSale?: number;
  startTime?: number;
  endTime?: number;
  erc20?: Address;
  listingType?: number;
  collection: Address;
  /** 0 for 721 sequential lazy; token id for 1155. */
  tokenId?: bigint;
  tokenSpec: number;
  acceptOffers?: boolean;
};

export function encodeCreateLazyListing(params: CreateLazyListingParams): Hex {
  const now = Math.floor(Date.now() / 1000);
  const startTime = params.startTime ?? now;
  const endTime = params.endTime ?? now + 60 * 60 * 24 * 30;

  return encodeFunctionData({
    abi: MARKETPLACE_ABI,
    functionName: 'createListing',
    args: [
      {
        initialAmount: params.priceWei,
        type_: params.listingType ?? ListingType.FIXED_PRICE,
        totalAvailable: params.totalAvailable,
        totalPerSale: params.totalPerSale ?? 1,
        extensionInterval: 0,
        minIncrementBPS: 0,
        erc20: params.erc20 ?? '0x0000000000000000000000000000000000000000',
        identityVerifier: '0x0000000000000000000000000000000000000000',
        startTime,
        endTime,
      },
      {
        id: params.tokenId ?? 0n,
        address_: params.collection,
        spec: params.tokenSpec,
        lazy: true,
      },
      {
        deliverBPS: 0,
        deliverFixed: 0n,
      },
      [],
      false,
      params.acceptOffers ?? false,
      '0x',
    ],
  });
}

/** CreateListing event topic helper — listingId is the first indexed / return value. */
export const CREATE_LISTING_EVENT = {
  type: 'event',
  name: 'CreateListing',
  inputs: [
    { name: 'listingId', type: 'uint40', indexed: true },
    { name: 'seller', type: 'address', indexed: true },
  ],
} as const;
