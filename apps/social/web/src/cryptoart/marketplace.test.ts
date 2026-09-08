import { describe, expect, it, vi } from 'vitest';
import { fetchAuctionCard, fetchLatestListings, personLabel } from './marketplace';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const auction = {
  listingId: '5', chainId: 1, marketplace: '0xmarket', seller: '0x1111111111111111111111111111111111111111',
  title: 'Respiration', description: 'Day 8', thumbnailUrl: 'https://example.com/art.webp', initialAmount: '50000000000000000',
  erc20: '0x0000000000000000000000000000000000000000', status: 'ACTIVE', finalized: false, hasBid: false,
  bidCount: 0, createdAt: '1785824519',
};

describe('auction timeline cards', () => {
  it('creates the configured active Ethereum feature from verified API data', async () => {
    const request = vi.fn(async (url: URL | RequestInfo) => String(url).includes('/api/auctions/')
      ? json({ success: true, auction })
      : json({ success: true, handles: [{ username: 'mxjxn', displayName: 'Max Jackson' }] }));
    const card = await fetchAuctionCard({ chainId: 1, listingId: '5' }, 'featured-auction', request as typeof fetch);
    expect(card).toMatchObject({ kind: 'featured-auction', title: 'Respiration', amount: '0.05', currency: 'ETH',
      href: '/listing/eth/5', seller: { username: 'mxjxn' } });
  });

  it('creates a sale only from finalized auction data with a winning bid', async () => {
    const sold = { ...auction, listingId: '6', title: 'NEARCASTER', status: 'FINALIZED', finalized: true, hasBid: true,
      highestBid: { amount: '20000000000000000', bidder: '0x2222222222222222222222222222222222222222', timestamp: '1787069363' } };
    const request = vi.fn(async (url: URL | RequestInfo) => String(url).includes('/api/auctions/')
      ? json({ success: true, auction: sold }) : json({ success: true, handles: [] }));
    const card = await fetchAuctionCard({ chainId: 1, listingId: '6' }, 'recent-sale', request as typeof fetch);
    expect(card).toMatchObject({ title: 'NEARCASTER', amount: '0.02', currency: 'ETH', timestamp: 1787069363000 });
    expect(personLabel(card.buyer!)).toBe('0x2222…2222');
  });

  it('rejects stale features, unsold activity, mismatched identities, and unknown tokens', async () => {
    const makeRequest = (value: object) => vi.fn(async () => json({ success: true, auction: value })) as unknown as typeof fetch;
    await expect(fetchAuctionCard({ chainId: 1, listingId: '5' }, 'featured-auction', makeRequest({ ...auction, status: 'FINALIZED' }))).rejects.toThrow('not active');
    await expect(fetchAuctionCard({ chainId: 1, listingId: '5' }, 'recent-sale', makeRequest(auction))).rejects.toThrow('not a finalized');
    await expect(fetchAuctionCard({ chainId: 1, listingId: '5' }, 'featured-auction', makeRequest({ ...auction, listingId: '7' }))).rejects.toThrow('did not match');
    await expect(fetchAuctionCard({ chainId: 1, listingId: '5' }, 'featured-auction', makeRequest({ ...auction, erc20: '0xtoken' }))).rejects.toThrow('unresolved');
  });

  it('builds a newest-first grid from live graph-backed listings and removes sold inventory', async () => {
    const fixed = { ...auction, chainId: 8453, listingId: '146', title: 'Based Mfer', listingType: 'FIXED_PRICE' as const,
      totalAvailable: '10', totalSold: '0' };
    const soldOut = { ...fixed, listingId: '145', totalSold: '10' };
    const request = vi.fn(async (url: URL | RequestInfo) => String(url).includes('/api/listings/browse')
      ? json({ success: true, listings: [fixed, soldOut] })
      : json({ success: true, auction: fixed }));
    const listings = await fetchLatestListings(request as typeof fetch);
    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({ listingId: '146', title: 'Based Mfer', amount: '0.05', available: 10,
      href: '/listing/base/146' });
  });
});
