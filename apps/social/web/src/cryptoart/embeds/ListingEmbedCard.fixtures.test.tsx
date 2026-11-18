import { describe, expect, it } from 'vitest';
import { listingDetailSnapshot, listingPhaseLabel, listingPriceLine } from './listingSnapshot';
import type { ListingDetail } from '../listingClient';
import { listingPhase } from '@cryptoart/marketplace';

function detail(overrides: Partial<ListingDetail> & Pick<ListingDetail, 'listingId'>): ListingDetail {
  return {
    chainId: 8453,
    marketplace: '0xmarket',
    seller: '0xseller',
    initialAmount: '10000000000000000',
    status: 'active',
    createdAt: new Date().toISOString(),
    listingType: 'INDIVIDUAL_AUCTION',
    ...overrides,
  };
}

describe('Listing embed presentation', () => {
  const states: Array<{ name: string; row: ListingDetail; phaseLabel: string }> = [
    {
      name: 'live auction',
      row: detail({ listingId: '1', endTime: Math.floor(Date.now() / 1000) + 3600, highestBid: { amount: '20000000000000000', bidder: '0xbid', timestamp: new Date().toISOString() } }),
      phaseLabel: 'Live',
    },
    {
      name: 'ended auction',
      row: detail({ listingId: '2', endTime: Math.floor(Date.now() / 1000) - 60 }),
      phaseLabel: 'Ended',
    },
    {
      name: 'sold',
      row: detail({ listingId: '3', finalized: true, totalSold: 1 }),
      phaseLabel: 'Sold',
    },
    {
      name: 'cancelled',
      row: detail({ listingId: '4', status: 'cancelled' }),
      phaseLabel: 'Cancelled',
    },
    {
      name: 'offers only',
      row: detail({ listingId: '5', listingType: 'OFFERS_ONLY' }),
      phaseLabel: 'Live',
    },
    {
      name: 'dynamic price',
      row: detail({ listingId: '6', listingType: 'DYNAMIC_PRICE', currentPrice: '5000000000000000' }),
      phaseLabel: 'Live',
    },
  ];

  it.each(states)('matches fixture phase and price for $name', ({ row, phaseLabel }) => {
    const snapshot = listingDetailSnapshot(row);
    const phase = row.status === 'cancelled' ? 'cancelled' : listingPhase(snapshot);
    expect(listingPhaseLabel(phase)).toBe(phaseLabel);
    const price = listingPriceLine(row, phase);
    expect(price.length).toBeGreaterThan(0);
    if (row.listingType === 'OFFERS_ONLY') {
      expect(price).toBe('Offers only');
    }
  });
});