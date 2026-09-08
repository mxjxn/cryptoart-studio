import { describe, expect, it, vi } from 'vitest';
import { fetchMarketPage, formatTokenAmount, normalizeMarketItem } from './marketClient';

const source = {
  listingId: '5', chainId: 1, marketplace: '0xmarket', seller: '0xseller',
  tokenAddress: '0xtoken', tokenId: '1', tokenSpec: 'ERC721' as const,
  listingType: 'INDIVIDUAL_AUCTION' as const, title: 'Respiration', image: 'ipfs://work',
  thumbnailUrl: 'https://cdn/work.webp', initialAmount: '50000000000000000',
  totalAvailable: '1', totalSold: '0', bidCount: 2, createdAt: '100', status: 'ACTIVE',
};

describe('market client', () => {
  it('normalizes source listings into artwork and commerce records', () => {
    expect(normalizeMarketItem(source)).toMatchObject({
      artwork: { title: 'Respiration', id: { chainId: 1, contractAddress: '0xtoken', tokenId: '1' } },
      commerce: { kind: 'auction', amount: '0.05', currency: 'ETH', status: 'active' },
    });
  });

  it('formats integer token amounts without floating point precision loss', () => {
    expect(formatTokenAmount('1000000000000000001', 18)).toBe('1.000000');
    expect(formatTokenAmount('5000000', 6)).toBe('5');
  });

  it('preserves pagination and degraded source state', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({
      success: true, listings: [source], degraded: true,
      pagination: { first: 1, skip: 0, hasMore: true },
    }))) as unknown as typeof fetch;
    const result = await fetchMarketPage({ first: 1 }, request);
    expect(result.items).toHaveLength(1);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.degraded).toBe(true);
  });
});
