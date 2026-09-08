export enum ListingType {
  INDIVIDUAL_AUCTION = 0,
  FIXED_PRICE = 1,
  DYNAMIC_PRICE = 2,
  OFFERS_ONLY = 3,
}

export type ListingPhase =
  | 'scheduled'
  | 'active'
  | 'concluded'
  | 'settlement-required'
  | 'finalized'
  | 'cancelled'
  | 'sold';

export type ListingSnapshot = {
  listingType: ListingType;
  seller: string;
  finalized: boolean;
  cancelled?: boolean;
  startTime: number;
  endTime: number;
  totalAvailable: number;
  totalSold: number;
  bidAmount: bigint;
  bidder: string;
};

const ZERO = '0x0000000000000000000000000000000000000000';

export function listingPhase(listing: ListingSnapshot, now = Math.floor(Date.now() / 1000)): ListingPhase {
  if (listing.cancelled) return 'cancelled';
  if (listing.finalized) {
    return listing.totalSold > 0 || listing.bidAmount > 0n ? 'sold' : 'finalized';
  }
  if (listing.startTime > now) return 'scheduled';
  if (listing.endTime > 0 && listing.endTime <= now) return 'settlement-required';
  if (listing.listingType !== ListingType.INDIVIDUAL_AUCTION && listing.totalSold >= listing.totalAvailable) {
    return 'sold';
  }
  return 'active';
}

export function isAuction(listing: Pick<ListingSnapshot, 'listingType'>) {
  return listing.listingType === ListingType.INDIVIDUAL_AUCTION;
}

export function canBid(listing: ListingSnapshot, now = Math.floor(Date.now() / 1000)) {
  return isAuction(listing) && listingPhase(listing, now) === 'active';
}

export function canBuy(listing: ListingSnapshot, now = Math.floor(Date.now() / 1000)) {
  return listing.listingType === ListingType.FIXED_PRICE && listingPhase(listing, now) === 'active';
}

export function canCancel(listing: ListingSnapshot, caller: string, onchainAdmin = false) {
  if (listing.finalized || listing.cancelled) return false;
  return listing.seller.toLowerCase() === caller.toLowerCase() || onchainAdmin;
}

export function canFinalize(listing: ListingSnapshot, caller: string, now = Math.floor(Date.now() / 1000)) {
  if (listing.finalized || listing.cancelled) return false;
  const phase = listingPhase(listing, now);
  if (phase !== 'settlement-required' && phase !== 'sold') return false;
  const isSeller = listing.seller.toLowerCase() === caller.toLowerCase();
  const isWinner = listing.bidder.toLowerCase() === caller.toLowerCase() && listing.bidAmount > 0n;
  return isSeller || isWinner;
}

export function minBid(listing: { bidAmount: bigint; initialAmount: bigint; minIncrementBPS: number }) {
  if (listing.bidAmount === 0n) return listing.initialAmount;
  return listing.bidAmount + (listing.bidAmount * BigInt(listing.minIncrementBPS)) / 10000n;
}

export function isNativeToken(erc20: string) {
  return !erc20 || erc20.toLowerCase() === ZERO;
}

export function cancelWarning(listing: ListingSnapshot) {
  if (listing.finalized) return 'This listing is already finalized and cannot be cancelled.';
  if (listing.bidAmount > 0n) return 'This listing has an active bid. Canceling will refund the bidder.';
  return 'This will permanently cancel the listing.';
}

export function recoveryState(input: {
  hash?: string;
  isPending?: boolean;
  isConfirming?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  errorMessage?: string;
}) {
  if (input.isSuccess) return { phase: 'confirmed' as const, message: 'Transaction confirmed.', hash: input.hash };
  if (input.isError) {
    return {
      phase: 'failed' as const,
      message: input.errorMessage || 'The wallet rejected or the transaction failed. You can retry or replace it.',
      hash: input.hash,
    };
  }
  if (input.isConfirming) return { phase: 'confirming' as const, message: 'Waiting for confirmation. Keep this tab open.', hash: input.hash };
  if (input.isPending) return { phase: 'pending' as const, message: 'Wallet confirmation required. If this stalls, reject in the wallet and retry.', hash: input.hash };
  return { phase: 'idle' as const, message: null, hash: input.hash };
}

export const ZERO_ADDRESS = ZERO;
