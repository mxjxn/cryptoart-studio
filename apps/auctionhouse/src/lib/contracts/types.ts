/**
 * TypeScript types matching the IMarketplaceCore Solidity interface
 */

export enum ListingType {
  INVALID = 0,
  INDIVIDUAL_AUCTION = 1,
  FIXED_PRICE = 2,
  DYNAMIC_PRICE = 3,
  OFFERS_ONLY = 4,
}

export enum TokenSpec {
  ERC721 = 0,
  ERC1155 = 1,
}

export interface ListingDetails {
  initialAmount: bigint;
  type_: ListingType;
  totalAvailable: number;
  totalPerSale: number;
  extensionInterval: number;
  minIncrementBPS: number;
  erc20: `0x${string}`;
  identityVerifier: `0x${string}`;
  startTime: bigint;
  endTime: bigint;
}

export interface TokenDetails {
  id: bigint;
  address_: `0x${string}`;
  spec: TokenSpec;
  lazy: boolean;
}

export interface DeliveryFees {
  deliverBPS: number;
  deliverFixed: bigint;
}

export interface ListingReceiver {
  receiver: `0x${string}`;
  receiverBPS: number;
}

export interface Bid {
  amount: bigint;
  bidder: `0x${string}`;
  delivered: boolean;
  settled: boolean;
  refunded: boolean;
  timestamp: bigint;
  referrer: `0x${string}`;
}

export interface Listing {
  id: bigint;
  seller: `0x${string}`;
  finalized: boolean;
  totalSold: number;
  marketplaceBPS: number;
  referrerBPS: number;
  details: ListingDetails;
  token: TokenDetails;
  receivers: ListingReceiver[];
  fees: DeliveryFees;
  bid: Bid;
  offersAccepted: boolean;
}

export interface Offer {
  offerer: `0x${string}`;
  amount: bigint;
  timestamp: bigint;
  accepted: boolean;
}

