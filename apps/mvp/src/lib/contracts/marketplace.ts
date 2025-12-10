import { base } from 'wagmi/chains';
import { type Address } from 'viem';

// Contract address on Base Mainnet
export const MARKETPLACE_ADDRESS = (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ||
  '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9') as Address;

// Base Mainnet chain ID
export const CHAIN_ID = base.id; // 8453

// ABI for the functions we need from IMarketplaceCore
export const MARKETPLACE_ABI = [
  {
    type: 'function',
    name: 'getListing',
    inputs: [{ name: 'listingId', type: 'uint40', internalType: 'uint40' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IMarketplaceCore.Listing',
        components: [
          { name: 'id', type: 'uint256', internalType: 'uint256' },
          { name: 'seller', type: 'address', internalType: 'address payable' },
          { name: 'finalized', type: 'bool', internalType: 'bool' },
          { name: 'totalSold', type: 'uint24', internalType: 'uint24' },
          { name: 'marketplaceBPS', type: 'uint16', internalType: 'uint16' },
          { name: 'referrerBPS', type: 'uint16', internalType: 'uint16' },
          {
            name: 'details',
            type: 'tuple',
            internalType: 'struct MarketplaceLib.ListingDetails',
            components: [
              { name: 'initialAmount', type: 'uint256', internalType: 'uint256' },
              { name: 'type_', type: 'uint8', internalType: 'enum MarketplaceLib.ListingType' },
              { name: 'totalAvailable', type: 'uint24', internalType: 'uint24' },
              { name: 'totalPerSale', type: 'uint24', internalType: 'uint24' },
              { name: 'extensionInterval', type: 'uint16', internalType: 'uint16' },
              { name: 'minIncrementBPS', type: 'uint16', internalType: 'uint16' },
              { name: 'erc20', type: 'address', internalType: 'address' },
              { name: 'identityVerifier', type: 'address', internalType: 'address' },
              { name: 'startTime', type: 'uint48', internalType: 'uint48' },
              { name: 'endTime', type: 'uint48', internalType: 'uint48' },
            ],
          },
          {
            name: 'token',
            type: 'tuple',
            internalType: 'struct MarketplaceLib.TokenDetails',
            components: [
              { name: 'id', type: 'uint256', internalType: 'uint256' },
              { name: 'address_', type: 'address', internalType: 'address' },
              { name: 'spec', type: 'uint8', internalType: 'enum TokenLib.Spec' },
              { name: 'lazy', type: 'bool', internalType: 'bool' },
            ],
          },
          {
            name: 'receivers',
            type: 'tuple[]',
            internalType: 'struct MarketplaceLib.ListingReceiver[]',
            components: [
              { name: 'receiver', type: 'address', internalType: 'address payable' },
              { name: 'receiverBPS', type: 'uint16', internalType: 'uint16' },
            ],
          },
          {
            name: 'fees',
            type: 'tuple',
            internalType: 'struct MarketplaceLib.DeliveryFees',
            components: [
              { name: 'deliverBPS', type: 'uint16', internalType: 'uint16' },
              { name: 'deliverFixed', type: 'uint240', internalType: 'uint240' },
            ],
          },
          {
            name: 'bid',
            type: 'tuple',
            internalType: 'struct MarketplaceLib.Bid',
            components: [
              { name: 'amount', type: 'uint256', internalType: 'uint256' },
              { name: 'bidder', type: 'address', internalType: 'address payable' },
              { name: 'delivered', type: 'bool', internalType: 'bool' },
              { name: 'settled', type: 'bool', internalType: 'bool' },
              { name: 'refunded', type: 'bool', internalType: 'bool' },
              { name: 'timestamp', type: 'uint48', internalType: 'uint48' },
              { name: 'referrer', type: 'address', internalType: 'address payable' },
            ],
          },
          { name: 'offersAccepted', type: 'bool', internalType: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getListingCurrentPrice',
    inputs: [{ name: 'listingId', type: 'uint40', internalType: 'uint40' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bid',
    inputs: [
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
      { name: 'increase', type: 'bool', internalType: 'bool' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'bid',
    inputs: [
      { name: 'referrer', type: 'address', internalType: 'address payable' },
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
      { name: 'increase', type: 'bool', internalType: 'bool' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'bid',
    inputs: [
      { name: 'referrer', type: 'address', internalType: 'address payable' },
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
      { name: 'bidAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'increase', type: 'bool', internalType: 'bool' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'createListing',
    inputs: [
      {
        name: 'listingDetails',
        type: 'tuple',
        internalType: 'struct MarketplaceLib.ListingDetails',
        components: [
          { name: 'initialAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'type_', type: 'uint8', internalType: 'enum MarketplaceLib.ListingType' },
          { name: 'totalAvailable', type: 'uint24', internalType: 'uint24' },
          { name: 'totalPerSale', type: 'uint24', internalType: 'uint24' },
          { name: 'extensionInterval', type: 'uint16', internalType: 'uint16' },
          { name: 'minIncrementBPS', type: 'uint16', internalType: 'uint16' },
          { name: 'erc20', type: 'address', internalType: 'address' },
          { name: 'identityVerifier', type: 'address', internalType: 'address' },
          { name: 'startTime', type: 'uint48', internalType: 'uint48' },
          { name: 'endTime', type: 'uint48', internalType: 'uint48' },
        ],
      },
      {
        name: 'tokenDetails',
        type: 'tuple',
        internalType: 'struct MarketplaceLib.TokenDetails',
        components: [
          { name: 'id', type: 'uint256', internalType: 'uint256' },
          { name: 'address_', type: 'address', internalType: 'address' },
          { name: 'spec', type: 'uint8', internalType: 'enum TokenLib.Spec' },
          { name: 'lazy', type: 'bool', internalType: 'bool' },
        ],
      },
      {
        name: 'deliveryFees',
        type: 'tuple',
        internalType: 'struct MarketplaceLib.DeliveryFees',
        components: [
          { name: 'deliverBPS', type: 'uint16', internalType: 'uint16' },
          { name: 'deliverFixed', type: 'uint240', internalType: 'uint240' },
        ],
      },
      {
        name: 'listingReceivers',
        type: 'tuple[]',
        internalType: 'struct MarketplaceLib.ListingReceiver[]',
        components: [
          { name: 'receiver', type: 'address', internalType: 'address payable' },
          { name: 'receiverBPS', type: 'uint16', internalType: 'uint16' },
        ],
      },
      { name: 'enableReferrer', type: 'bool', internalType: 'bool' },
      { name: 'acceptOffers', type: 'bool', internalType: 'bool' },
      { name: 'data', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: '', type: 'uint40', internalType: 'uint40' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancel',
    inputs: [
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
      { name: 'holdbackBPS', type: 'uint16', internalType: 'uint16' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'modifyListing',
    inputs: [
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
      { name: 'initialAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'startTime', type: 'uint48', internalType: 'uint48' },
      { name: 'endTime', type: 'uint48', internalType: 'uint48' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'finalize',
    inputs: [
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'purchase',
    inputs: [
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
      { name: 'count', type: 'uint24', internalType: 'uint24' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'purchase',
    inputs: [
      { name: 'referrer', type: 'address', internalType: 'address' },
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'purchase',
    inputs: [
      { name: 'referrer', type: 'address', internalType: 'address' },
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
      { name: 'count', type: 'uint24', internalType: 'uint24' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'offer',
    inputs: [
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
      { name: 'increase', type: 'bool', internalType: 'bool' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'accept',
    inputs: [
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
      { name: 'addresses', type: 'address[]', internalType: 'address[]' },
      { name: 'amounts', type: 'uint256[]', internalType: 'uint256[]' },
      { name: 'maxAmount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getOffers',
    inputs: [
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct IMarketplaceCore.Offer[]',
        components: [
          { name: 'offerer', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' },
          { name: 'timestamp', type: 'uint48', internalType: 'uint48' },
          { name: 'accepted', type: 'bool', internalType: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getListingTotalPrice',
    inputs: [
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
      { name: 'count', type: 'uint24', internalType: 'uint24' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isAdmin',
    inputs: [{ name: 'admin', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'CreateListing',
    inputs: [
      { name: 'listingId', type: 'uint40', indexed: true, internalType: 'uint40' },
      { name: 'marketplaceBPS', type: 'uint16', indexed: false, internalType: 'uint16' },
      { name: 'referrerBPS', type: 'uint16', indexed: false, internalType: 'uint16' },
      { name: 'listingType', type: 'uint8', indexed: false, internalType: 'uint8' },
      { name: 'totalAvailable', type: 'uint24', indexed: false, internalType: 'uint24' },
      { name: 'totalPerSale', type: 'uint24', indexed: false, internalType: 'uint24' },
      { name: 'startTime', type: 'uint48', indexed: false, internalType: 'uint48' },
      { name: 'endTime', type: 'uint48', indexed: false, internalType: 'uint48' },
      { name: 'initialAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'extensionInterval', type: 'uint16', indexed: false, internalType: 'uint16' },
      { name: 'minIncrementBPS', type: 'uint16', indexed: false, internalType: 'uint16' },
      { name: 'erc20', type: 'address', indexed: false, internalType: 'address' },
      { name: 'identityVerifier', type: 'address', indexed: false, internalType: 'address' },
    ],
    anonymous: false,
  },
] as const;

// Split ABI for purchase function to avoid overload resolution issues
// ABI for purchase(listingId, count) - 2 params, no referrer
export const PURCHASE_ABI_NO_REFERRER = [
  {
    type: 'function',
    name: 'purchase',
    inputs: [
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
      { name: 'count', type: 'uint24', internalType: 'uint24' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const;

// ABI for purchase(referrer, listingId, count) - 3 params, with referrer
export const PURCHASE_ABI_WITH_REFERRER = [
  {
    type: 'function',
    name: 'purchase',
    inputs: [
      { name: 'referrer', type: 'address', internalType: 'address' },
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
      { name: 'count', type: 'uint24', internalType: 'uint24' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const;

/**
 * Contract listing structure from getListing()
 */
export type ContractListing = {
  id: bigint;
  seller: `0x${string}`;
  finalized: boolean;
  totalSold: number;
  marketplaceBPS: number;
  referrerBPS: number;
  details: {
    initialAmount: bigint;
    type_: number; // enum MarketplaceLib.ListingType
    totalAvailable: number;
    totalPerSale: number;
    extensionInterval: number;
    minIncrementBPS: number;
    erc20: `0x${string}`;
    identityVerifier: `0x${string}`;
    startTime: bigint;
    endTime: bigint;
  };
  token: {
    id: bigint;
    address_: `0x${string}`;
    spec: number; // enum TokenLib.Spec
    lazy: boolean;
  };
  receivers: Array<{
    receiver: `0x${string}`;
    receiverBPS: number;
  }>;
  fees: {
    deliverBPS: number;
    deliverFixed: bigint;
  };
  bid: {
    amount: bigint;
    bidder: `0x${string}`;
    delivered: boolean;
    settled: boolean;
    refunded: boolean;
    timestamp: bigint;
    referrer: `0x${string}`;
  };
  offersAccepted: boolean;
};

/**
 * Listing type enum values (from MarketplaceLib.ListingType)
 */
export enum ListingType {
  INDIVIDUAL_AUCTION = 0,
  FIXED_PRICE = 1,
  DYNAMIC_PRICE = 2,
  OFFERS_ONLY = 3,
}

/**
 * Check if a listing has an active bid
 * A bid is considered active if it has a non-zero amount
 */
export function hasBid(listing: ContractListing): boolean {
  return listing.bid.amount > 0n;
}

/**
 * Check if a listing is finalized
 */
export function isFinalized(listing: ContractListing): boolean {
  return listing.finalized;
}

/**
 * Get the listing type as an enum value
 */
export function getListingType(listing: ContractListing): ListingType {
  return listing.details.type_ as ListingType;
}

/**
 * Check if listing is an auction type
 */
export function isAuction(listing: ContractListing): boolean {
  return getListingType(listing) === ListingType.INDIVIDUAL_AUCTION;
}

/**
 * Check if listing can be cancelled by admin
 * Returns true if listing exists and is not finalized
 */
export function canCancelListing(listing: ContractListing | null | undefined): boolean {
  if (!listing) return false;
  return !isFinalized(listing);
}

/**
 * Get warning message for canceling a listing
 */
export function getCancelWarning(listing: ContractListing | null | undefined): string | null {
  if (!listing) return null;
  
  if (isFinalized(listing)) {
    return "This listing is already finalized and cannot be cancelled.";
  }
  
  if (hasBid(listing)) {
    const bidAmount = listing.bid.amount;
    return `This listing has an active bid of ${bidAmount.toString()}. Canceling will refund the bidder.`;
  }
  
  return "This will permanently cancel the listing.";
}

