import { sql } from 'drizzle-orm';
import type { Address } from 'viem';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
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
  tx: PostgresJsDatabase<Record<string, never>> | any,
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
  const normalizedMarketplace = (marketplace || '0x0000000000000000000000000000000000000000').toLowerCase();

  await tx
    .insert(listings)
    .values({
      chainId,
      listingId: args.listingId.toString(),
      marketplace: normalizedMarketplace,
      seller: normalizedSeller,
      tokenAddress: '0x0000000000000000000000000000000000000000',
      tokenId: null,
      tokenSpec: 0,
      lazy: 0,
      listingType: args.listingType,
      initialAmount: args.initialAmount.toString(),
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
      deliverBPS: 0,
      deliverFixed: '0',
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
        initialAmount: args.initialAmount.toString(),
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

export async function processCreateListingTokenDetails(
  tx: PostgresJsDatabase<Record<string, never>> | any,
  chainId: number,
  args: ListingTokenDetailsArgs,
  blockNumber: bigint,
  timestamp: bigint
): Promise<void> {
  const normalizedAddress = (args.address_ as string).toLowerCase();

  await tx.execute(sql`
    UPDATE chain_indexer_listings
    SET 
      token_address = ${normalizedAddress},
      token_id = ${args.id.toString()},
      token_spec = ${args.spec},
      lazy = ${args.lazy ? 1 : 0},
      updated_at = ${new Date(Number(timestamp) * 1000)},
      updated_at_block = ${blockNumber}
    WHERE chain_id = ${chainId} AND listing_id = ${args.listingId.toString()}
  `);
}

export async function processCreateListingFees(
  tx: PostgresJsDatabase<Record<string, never>> | any,
  chainId: number,
  args: ListingFeesArgs,
  blockNumber: bigint,
  timestamp: bigint
): Promise<void> {
  await tx.execute(sql`
    UPDATE chain_indexer_listings
    SET 
      deliver_bps = ${args.deliverBPS},
      deliver_fixed = ${args.deliverFixed.toString()},
      updated_at = ${new Date(Number(timestamp) * 1000)},
      updated_at_block = ${blockNumber}
    WHERE chain_id = ${chainId} AND listing_id = ${args.listingId.toString()}
  `);
}

export async function processBidEvent(
  tx: PostgresJsDatabase<Record<string, never>> | any,
  chainId: number,
  args: BidEventArgs,
  blockNumber: bigint,
  timestamp: bigint,
  transactionHash: string,
  logIndex: number
): Promise<void> {
  const normalizedBidder = (args.bidder as string).toLowerCase();
  const normalizedReferrer = args.referrer ? (args.referrer as string).toLowerCase() : null;

  await tx
    .insert(bids)
    .values({
      chainId,
      listingId: args.listingId.toString(),
      referrer: normalizedReferrer,
      bidder: normalizedBidder,
      amount: args.amount.toString(),
      timestamp,
      blockNumber,
      transactionHash,
      logIndex,
    })
    .onConflictDoNothing();

  await tx.execute(sql`
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
    WHERE chain_id = ${chainId} AND listing_id = ${args.listingId.toString()}
  `);
}

export async function processPurchaseEvent(
  tx: PostgresJsDatabase<Record<string, never>> | any,
  chainId: number,
  args: PurchaseEventArgs,
  blockNumber: bigint,
  timestamp: bigint,
  transactionHash: string,
  logIndex: number
): Promise<void> {
  const normalizedBuyer = (args.buyer as string).toLowerCase();
  const normalizedReferrer = args.referrer ? (args.referrer as string).toLowerCase() : null;

  await tx
    .insert(purchases)
    .values({
      chainId,
      listingId: args.listingId.toString(),
      referrer: normalizedReferrer,
      buyer: normalizedBuyer,
      count: args.count,
      amount: args.amount.toString(),
      timestamp,
      blockNumber,
      transactionHash,
      logIndex,
    })
    .onConflictDoNothing();

  await tx.execute(sql`
    UPDATE chain_indexer_listings
    SET 
      total_sold = total_sold + (${args.count} * total_per_sale),
      updated_at = ${new Date(Number(timestamp) * 1000)},
      updated_at_block = ${blockNumber}
    WHERE chain_id = ${chainId} AND listing_id = ${args.listingId.toString()}
  `);
}

export async function processOfferEvent(
  tx: PostgresJsDatabase<Record<string, never>> | any,
  chainId: number,
  args: OfferEventArgs,
  blockNumber: bigint,
  timestamp: bigint,
  transactionHash: string,
  logIndex: number
): Promise<void> {
  const normalizedOfferer = (args.offerrer as string).toLowerCase();
  const normalizedReferrer = args.referrer ? (args.referrer as string).toLowerCase() : null;

  await tx
    .insert(offers)
    .values({
      chainId,
      listingId: args.listingId.toString(),
      referrer: normalizedReferrer,
      offerer: normalizedOfferer,
      amount: args.amount.toString(),
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

export async function processModifyListing(
  tx: PostgresJsDatabase<Record<string, never>> | any,
  chainId: number,
  args: ModifyListingArgs,
  blockNumber: bigint,
  timestamp: bigint
): Promise<void> {
  await tx.execute(sql`
    UPDATE chain_indexer_listings
    SET 
      initial_amount = ${args.initialAmount.toString()},
      start_time = ${args.startTime},
      end_time = ${args.endTime},
      updated_at = ${new Date(Number(timestamp) * 1000)},
      updated_at_block = ${blockNumber}
    WHERE chain_id = ${chainId} AND listing_id = ${args.listingId.toString()}
  `);
}

export async function processCancelListing(
  tx: PostgresJsDatabase<Record<string, never>> | any,
  chainId: number,
  args: CancelListingArgs,
  blockNumber: bigint,
  timestamp: bigint
): Promise<void> {
  await tx.execute(sql`
    UPDATE chain_indexer_listings
    SET 
      status = 'CANCELLED',
      updated_at = ${new Date(Number(timestamp) * 1000)},
      updated_at_block = ${blockNumber}
    WHERE chain_id = ${chainId} AND listing_id = ${args.listingId.toString()}
  `);
}

export async function processFinalizeListing(
  tx: PostgresJsDatabase<Record<string, never>> | any,
  chainId: number,
  args: FinalizeListingArgs,
  blockNumber: bigint,
  timestamp: bigint
): Promise<void> {
  await tx.execute(sql`
    UPDATE chain_indexer_listings
    SET 
      status = 'FINALIZED',
      finalized = 1,
      updated_at = ${new Date(Number(timestamp) * 1000)},
      updated_at_block = ${blockNumber}
    WHERE chain_id = ${chainId} AND listing_id = ${args.listingId.toString()}
  `);
}

export async function processEscrowEvent(
  tx: PostgresJsDatabase<Record<string, never>> | any,
  chainId: number,
  args: EscrowEventArgs,
  blockNumber: bigint,
  timestamp: bigint,
  transactionHash: string,
  logIndex: number
): Promise<void> {
  const normalizedReceiver = (args.receiver as string).toLowerCase();
  const normalizedErc20 = (args.erc20 as string).toLowerCase();

  await tx
    .insert(escrows)
    .values({
      chainId,
      receiver: normalizedReceiver,
      erc20: normalizedErc20,
      amount: args.amount.toString(),
      timestamp,
      blockNumber,
      transactionHash,
      logIndex,
    })
    .onConflictDoNothing();
}
