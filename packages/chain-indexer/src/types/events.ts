import type { Address, Hex } from 'viem';

/**
 * Chain event as stored in the database
 * Generic shape for all indexed events
 */
export interface ChainEvent {
  chainId: number;
  contract: Address;
  eventName: string;
  blockNumber: bigint;
  blockHash: Hex;
  transactionHash: Hex;
  logIndex: number;
  args: Record<string, unknown>;
}

/**
 * Indexer checkpoint tracking progress per contract/chain
 */
export interface IndexerCheckpoint {
  chainId: number;
  contract: Address;
  lastBlock: bigint;
  updatedAt: Date;
}

/**
 * Contract configuration for indexing
 */
export interface ContractConfig {
  chainId: number;
  address: Address;
  startBlock: bigint;
  abi: unknown[]; // ABI array
  events: string[]; // Event names to index
  label?: string; // Human-readable label
}

/**
 * Indexing job result
 */
export interface IndexingResult {
  contract: Address;
  chainId: number;
  startBlock: bigint;
  endBlock: bigint;
  eventsIndexed: number;
  timeTaken: number;
  errors?: string[];
}

/**
 * Marketplace event types (for domain-specific processing)
 */
export interface ListingCreatedArgs {
  listingId: bigint;
  seller: Address;
  listingType: number;
  initialAmount: bigint;
  totalAvailable: number;
  totalPerSale: number;
  startTime: bigint;
  endTime: bigint;
  extensionInterval: number;
  minIncrementBPS: number;
  erc20: Address;
  identityVerifier: Address;
  marketplaceBPS: number;
  referrerBPS: number;
}

export interface ListingTokenDetailsArgs {
  listingId: bigint;
  id: bigint; // tokenId
  address_: Address; // tokenAddress
  spec: number; // tokenSpec
  lazy: boolean;
}

export interface ListingFeesArgs {
  listingId: bigint;
  deliverBPS: number;
  deliverFixed: bigint;
}

export interface BidEventArgs {
  listingId: bigint;
  referrer: Address;
  bidder: Address;
  amount: bigint;
}

export interface PurchaseEventArgs {
  listingId: bigint;
  referrer: Address;
  buyer: Address;
  count: number;
  amount: bigint;
}

export interface OfferEventArgs {
  listingId: bigint;
  referrer: Address;
  offerrer: Address; // Note: typo in ABI
  amount: bigint;
}

export interface ModifyListingArgs {
  listingId: bigint;
  initialAmount: bigint;
  startTime: bigint;
  endTime: bigint;
}

export interface CancelListingArgs {
  listingId: bigint;
  holder: Address;
  holdCount: number;
}

export interface FinalizeListingArgs {
  listingId: bigint;
}

export interface EscrowEventArgs {
  receiver: Address;
  erc20: Address;
  amount: bigint;
}
