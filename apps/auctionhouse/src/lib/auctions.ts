/**
 * Auction utility functions for formatting, calculations, and status checks
 */

import { type Listing, ListingType, type Bid } from './contracts/types';
import { formatEther, parseEther } from 'viem';

/**
 * Format ETH amount to readable string
 */
export function formatEth(amount: bigint | string): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount;
  return formatEther(value);
}

/**
 * Parse ETH string to BigInt
 */
export function parseEth(amount: string): bigint {
  return parseEther(amount);
}

/**
 * Calculate minimum bid amount for an auction
 */
export function calculateMinimumBid(listing: Listing): bigint {
  const currentPrice = listing.bid.amount || listing.details.initialAmount;
  const minIncrementBPS = listing.details.minIncrementBPS;
  const increment = (currentPrice * BigInt(minIncrementBPS)) / BigInt(10000);
  return currentPrice + increment;
}

/**
 * Check if auction has started
 */
export function isAuctionStarted(listing: Listing): boolean {
  if (listing.details.startTime === 0n) {
    // Start time of 0 means it starts on first bid
    return true;
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  return now >= listing.details.startTime;
}

/**
 * Check if auction has ended
 */
export function isAuctionEnded(listing: Listing): boolean {
  if (listing.finalized) {
    return true;
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  return now >= listing.details.endTime;
}

/**
 * Check if auction is active (started but not ended)
 */
export function isAuctionActive(listing: Listing): boolean {
  return isAuctionStarted(listing) && !isAuctionEnded(listing);
}

/**
 * Get time remaining until auction ends (in seconds)
 */
export function getTimeRemaining(listing: Listing): bigint {
  if (isAuctionEnded(listing)) {
    return 0n;
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (listing.details.endTime <= now) {
    return 0n;
  }
  return listing.details.endTime - now;
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(seconds: bigint): string {
  const secs = Number(seconds);
  if (secs <= 0) {
    return 'Ended';
  }

  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const remainingSeconds = secs % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

/**
 * Get current bid amount (returns reserve price if no bids)
 */
export function getCurrentBidAmount(listing: Listing): bigint {
  return listing.bid.amount || listing.details.initialAmount;
}

/**
 * Check if listing is an INDIVIDUAL_AUCTION
 */
export function isIndividualAuction(listing: Listing): boolean {
  return listing.details.type_ === ListingType.INDIVIDUAL_AUCTION;
}

/**
 * Get auction status as string
 */
export function getAuctionStatus(listing: Listing): 'not_started' | 'active' | 'ended' | 'finalized' {
  if (listing.finalized) {
    return 'finalized';
  }
  if (isAuctionEnded(listing)) {
    return 'ended';
  }
  if (isAuctionActive(listing)) {
    return 'active';
  }
  return 'not_started';
}

/**
 * Format auction status for display
 */
export function formatAuctionStatus(status: ReturnType<typeof getAuctionStatus>): string {
  switch (status) {
    case 'not_started':
      return 'Not Started';
    case 'active':
      return 'Active';
    case 'ended':
      return 'Ended';
    case 'finalized':
      return 'Finalized';
  }
}

