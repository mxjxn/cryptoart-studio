import { describe, expect, it } from 'vitest';
import { listingPath, parseListingPath } from './addresses';
import { ListingType, canBid, canFinalize, listingPhase, minBid, recoveryState } from './lifecycle';

const auction = {
  listingType: ListingType.INDIVIDUAL_AUCTION,
  seller: '0x1111111111111111111111111111111111111111',
  finalized: false,
  startTime: 1,
  endTime: 2_000_000_000,
  totalAvailable: 1,
  totalSold: 0,
  bidAmount: 0n,
  bidder: '0x0000000000000000000000000000000000000000',
};

describe('marketplace lifecycle', () => {
  it('preserves canonical listing paths', () => {
    expect(listingPath(1, '5')).toBe('/listing/eth/5');
    expect(parseListingPath('/listing/base/146')).toEqual({ chainId: 8453, listingId: '146' });
    expect(parseListingPath('/listing/99')).toEqual({ chainId: 8453, listingId: '99' });
  });

  it('moves an ended auction into settlement-required until finalize', () => {
    const ended = { ...auction, endTime: 10, bidAmount: 10n, bidder: '0x2222222222222222222222222222222222222222' };
    expect(listingPhase(ended, 11)).toBe('settlement-required');
    expect(canBid(ended, 11)).toBe(false);
    expect(canFinalize(ended, ended.bidder, 11)).toBe(true);
    expect(canFinalize(ended, '0x3333333333333333333333333333333333333333', 11)).toBe(false);
  });

  it('computes the minimum increment from the current bid', () => {
    expect(minBid({ bidAmount: 0n, initialAmount: 100n, minIncrementBPS: 500 })).toBe(100n);
    expect(minBid({ bidAmount: 100n, initialAmount: 100n, minIncrementBPS: 500 })).toBe(105n);
  });

  it('exposes pending and failed recovery states without hiding the hash', () => {
    expect(recoveryState({ isPending: true, hash: '0xabc' }).phase).toBe('pending');
    expect(recoveryState({ isError: true, hash: '0xabc' }).phase).toBe('failed');
  });
});
