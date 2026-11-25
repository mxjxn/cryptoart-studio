import { describe, expect, it } from 'vitest';
import { mapBidRow, mapListingRow } from './listing-map';
import type { Bid, Listing } from '../schema';

const sampleListing = {
  chainId: 8453,
  listingId: '42',
  marketplace: '0x1cb0c1f72ba7547fc99c4b5333d8aba1ed6b31a9',
  seller: '0xabc',
  tokenAddress: '0xtoken',
  tokenId: '1',
  tokenSpec: 1,
  lazy: 0,
  listingType: 2,
  initialAmount: '1000000000000000000',
  totalAvailable: 10,
  totalPerSale: 1,
  totalSold: 0,
  startTime: 1700000000n,
  endTime: 1700003600n,
  extensionInterval: 0,
  minIncrementBPS: 500,
  erc20: null,
  identityVerifier: null,
  marketplaceBPS: 500,
  referrerBPS: 0,
  deliverBPS: 0,
  deliverFixed: '0',
  status: 'ACTIVE',
  hasBid: 0,
  finalized: 0,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  createdAtBlock: 38886001n,
  updatedAt: new Date('2024-01-02T00:00:00Z'),
  updatedAtBlock: 38886002n,
} as Listing;

const sampleBid = {
  chainId: 8453,
  listingId: '42',
  referrer: null,
  bidder: '0xbidder',
  amount: '2000000000000000000',
  timestamp: 1700001000n,
  blockNumber: 38887000n,
  transactionHash: '0xtx',
  logIndex: 3,
} as Bid;

describe('mapListingRow', () => {
  it('maps listing and sorts bids by amount desc', () => {
    const low = { ...sampleBid, amount: '1', logIndex: 1 };
    const high = { ...sampleBid, amount: '9', logIndex: 2 };
    const mapped = mapListingRow(sampleListing, [low, high], 8453);
    expect(mapped.listingId).toBe('42');
    expect(mapped.chainId).toBe(8453);
    expect(mapped.lazy).toBe(false);
    expect(mapped.bids[0]!.amount).toBe('9');
    expect(mapped.createdAt).toBe('1704067200');
  });
});

describe('mapBidRow', () => {
  it('builds subgraph-style bid id', () => {
    expect(mapBidRow(sampleBid).id).toBe('0xtx-3');
  });
});