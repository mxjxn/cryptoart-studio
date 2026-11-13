import { db } from '@cryptoart/db/client';
import { sql } from 'drizzle-orm';
import type { Address } from 'viem';
import {
  listings,
  bids,
  purchases,
  offers,
  escrows,
} from '../schema';
import type {
  ListingCreatedArgs,
  ListingTokenDetailsArgs,
  ListingFeesArgs,
  BidEventArgs,
  PurchaseEventArgs,
  OfferEventArgs,
  ModifyListingArgs,
  CancelListingArgs,
  FinalizeListingArgs,
  EscrowEventArgs,
} from '../types/events';

/**
 * Process CreateListing event
 */
export async function processCreateListing(
  chainId: number,
  args: ListingCreatedArgs,
  blockNumber: bigint,
  timestamp: bigint,
  marketplace?: string
): Promise<void> {
  const normalizedSeller = (args.seller as string).toLowerCase();
  const normalizedErc20 = args.erc20 ? (args.erc20 as string).toLowerCase() : null;
  const normalizedVerifier = args.identityVerifier
    ? (args.identityVerifier as string).toLowerCase()
    : null;

  await db
    .insert(listings)
    .values({
      chainId,
      listingId: args.listingId,
      marketplace: marketplace || '0x0000000000000000000000000000000000000000',
      seller: normalizedSeller,
      tokenAddress: '0x0000000000000000000000000000000000000000', // Will be set by CreateListingTokenDetails
      tokenId: null,
      tokenSpec: 0,
      lazy: 0,
      listingType: args.listingType,
      initialAmount: args.initialAmount,
      totalAvailable: args.totalAvailable,
      totalPerSale: args.totalPerSale,
      totalSold: 0,
      startTime: args.startTime,
      endTime: args.endTime,
      extensionInterval: args.extensionInterval,
      minIncrementBPS: args.minIncrementBPS,
      erc20: normalizedErc20,
      identityVerifier: normalizedVerifier,
      marketplaceBPS: args.marketplaceBPS,
      referrerBPS: args.referrerBPS,
      deliverBPS: 0, // Will be set by CreateListingFees
      deliverFixed: 0n,
      status: 'ACTIVE',
      hasBid: 0,
      finalized: 0,
      createdAt: new Date(Number(timestamp) * 1000),
      createdAtBlock: blockNumber,
      updatedAt: new Date(Number(timestamp) * 1000),
      updatedAtBlock: blockNumber,
    })
    .onConflictDoUpdate({
      target: [listings.chainId, listings.listingId, listings.marketplace],
      set: {
        seller: normalizedSeller,
        listingType: args.listingType,
        initialAmount: args.initialAmount,
        totalAvailable: args.totalAvailable,
        totalPerSale: args.totalPerSale,
        startTime: args.startTime,
        endTime: args.endTime,
        extensionInterval: args.extensionInterval,
        minIncrementBPS: args.minIncrementBPS,
        erc20: normalizedErc20,
        identityVerifier: normalizedVerifier,
        marketplaceBPS: args.marketplaceBPS,
        referrerBPS: args.referrerBPS,
        updatedAt: new Date(Number(timestamp) * 1000),
        updatedAtBlock: blockNumber,
      },
    });
}

/**
 * Process CreateListingTokenDetails event
 */
export async function processCreateListingTokenDetails(
  chainId: number,
  args: ListingTokenDetailsArgs,
  blockNumber: bigint,
  timestamp: bigint
): Promise<void> {
  const normalizedAddress = (args.address_ as string).toLowerCase();

  await db
    .update(listings)
    .set({
      tokenAddress: normalizedAddress,
      tokenId: args.id,
      tokenSpec: args.spec,
      lazy: args.lazy ? 1 : 0,
      updatedAt: new Date(Number(timestamp) * 1000),
      updatedAtBlock: blockNumber,
    })
    .where(
      sql`${listings.chainId} = ${chainId} AND ${listings.listingId} = ${args.listingId}`
    );
}

/**
 * Process CreateListingFees event
 */
export async function processCreateListingFees(
  chainId: number,
  args: ListingFeesArgs,
  blockNumber: bigint,
  timestamp: bigint
): Promise<void> {
  await db
    .update(listings)
    .set({
      deliverBPS: args.deliverBPS,
      deliverFixed: args.deliverFixed,
      updatedAt: new Date(Number(timestamp) * 1000),
      updatedAtBlock: blockNumber,
    })
    .where(
      sql`${listings.chainId} = ${chainId} AND ${listings.listingId} = ${args.listingId}`
    );
}

/**
 * Process BidEvent
 */
export async function processBidEvent(
  chainId: number,
  args: BidEventArgs,
  blockNumber: bigint,
  timestamp: bigint,
  transactionHash: string,
  logIndex: number
): Promise<void> {
  const normalizedBidder = (args.bidder as string).toLowerCase();
  const normalizedReferrer = args.referrer ? (args.referrer as string).toLowerCase() : null;

  // Insert bid
  await db
    .insert(bids)
    .values({
      chainId,
      listingId: args.listingId,
      referrer: normalizedReferrer,
      bidder: normalizedBidder,
      amount: args.amount,
      timestamp,
      blockNumber,
      transactionHash,
      logIndex,
    })
    .onConflictDoNothing();

  // Update listing hasBid flag and potentially adjust start/end time for first bid
  await db.execute(sql`
    UPDATE chain_indexer_listings
    SET 
      has_bid = 1,
      start_time = CASE 
        WHEN has_bid = 0 AND start_time = 0 THEN ${timestamp}
        ELSE start_time
      END,
      end_time = CASE
        WHEN has_bid = 0 AND start_time = 0 THEN end_time + ${timestamp}
        ELSE end_time
      END,
      updated_at = ${new Date(Number(timestamp) * 1000)},
      updated_at_block = ${blockNumber}
    WHERE chain_id = ${chainId} AND listing_id = ${args.listingId}
  `);
}

/**
 * Process PurchaseEvent
 */
export async function processPurchaseEvent(
  chainId: number,
  args: PurchaseEventArgs,
  blockNumber: bigint,
  timestamp: bigint,
  transactionHash: string,
  logIndex: number
): Promise<void> {
  const normalizedBuyer = (args.buyer as string).toLowerCase();
  const normalizedReferrer = args.referrer ? (args.referrer as string).toLowerCase() : null;

  // Insert purchase
  await db
    .insert(purchases)
    .values({
      chainId,
      listingId: args.listingId,
      referrer: normalizedReferrer,
      buyer: normalizedBuyer,
      count: args.count,
      amount: args.amount,
      timestamp,
      blockNumber,
      transactionHash,
      logIndex,
    })
    .onConflictDoNothing();

  // Update listing totalSold
  // Note: totalSold += count * totalPerSale (as per contract logic)
  await db.execute(sql`
    UPDATE chain_indexer_listings
    SET 
      total_sold = total_sold + (${args.count} * total_per_sale),
      updated_at = ${new Date(Number(timestamp) * 1000)},
      updated_at_block = ${blockNumber}
    WHERE chain_id = ${chainId} AND listing_id = ${args.listingId}
  `);
}

/**
 * Process OfferEvent
 */
export async function processOfferEvent(
  chainId: number,
  args: OfferEventArgs,
  blockNumber: bigint,
  timestamp: bigint,
  transactionHash: string,
  logIndex: number
): Promise<void> {
  const normalizedOfferer = (args.offerrer as string).toLowerCase(); // Note: typo in ABI
  const normalizedReferrer = args.referrer ? (args.referrer as string).toLowerCase() : null;

  await db
    .insert(offers)
    .values({
      chainId,
      listingId: args.listingId,
      referrer: normalizedReferrer,
      offerer: normalizedOfferer,
      amount: args.amount,
      status: 'PENDING',
      timestamp,
      blockNumber,
      transactionHash,
      logIndex,
      acceptedAt: null,
      rescindedAt: null,
    })
    .onConflictDoNothing();
}

/**
 * Process ModifyListing event
 */
export async function processModifyListing(
  chainId: number,
  args: ModifyListingArgs,
  blockNumber: bigint,
  timestamp: bigint
): Promise<void> {
  await db
    .update(listings)
    .set({
      initialAmount: args.initialAmount,
      startTime: args.startTime,
      endTime: args.endTime,
      updatedAt: new Date(Number(timestamp) * 1000),
      updatedAtBlock: blockNumber,
    })
    .where(
      sql`${listings.chainId} = ${chainId} AND ${listings.listingId} = ${args.listingId}`
    );
}

/**
 * Process CancelListing event
 */
export async function processCancelListing(
  chainId: number,
  args: CancelListingArgs,
  blockNumber: bigint,
  timestamp: bigint
): Promise<void> {
  await db
    .update(listings)
    .set({
      status: 'CANCELLED',
      updatedAt: new Date(Number(timestamp) * 1000),
      updatedAtBlock: blockNumber,
    })
    .where(
      sql`${listings.chainId} = ${chainId} AND ${listings.listingId} = ${args.listingId}`
    );
}

/**
 * Process FinalizeListing event
 */
export async function processFinalizeListing(
  chainId: number,
  args: FinalizeListingArgs,
  blockNumber: bigint,
  timestamp: bigint
): Promise<void> {
  await db
    .update(listings)
    .set({
      status: 'FINALIZED',
      finalized: 1,
      updatedAt: new Date(Number(timestamp) * 1000),
      updatedAtBlock: blockNumber,
    })
    .where(
      sql`${listings.chainId} = ${chainId} AND ${listings.listingId} = ${args.listingId}`
    );
}

/**
 * Process Escrow event
 */
export async function processEscrowEvent(
  chainId: number,
  args: EscrowEventArgs,
  blockNumber: bigint,
  timestamp: bigint,
  transactionHash: string,
  logIndex: number
): Promise<void> {
  const normalizedReceiver = (args.receiver as string).toLowerCase();
  const normalizedErc20 = (args.erc20 as string).toLowerCase();

  await db
    .insert(escrows)
    .values({
      chainId,
      receiver: normalizedReceiver,
      erc20: normalizedErc20,
      amount: args.amount,
      timestamp,
      blockNumber,
      transactionHash,
      logIndex,
    })
    .onConflictDoNothing();
}
