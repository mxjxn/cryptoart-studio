import { describe, expect, it } from 'vitest';
import { parseAirdrop1155, parseAirdrop721 } from './airdrop';

describe('parseAirdrop721', () => {
  it('parses address,uri rows and rejects invalid addresses', () => {
    const result = parseAirdrop721(
      `address,uri
0x1111111111111111111111111111111111111111,ar://a
not-an-address,ar://b
0x2222222222222222222222222222222222222222`,
      'ar://default',
    );
    expect(result.recipients).toHaveLength(2);
    expect(result.recipients[1]?.uri).toBe('ar://default');
    expect(result.errors.some((e) => e.includes('wallet address'))).toBe(true);
  });
});

describe('parseAirdrop1155', () => {
  it('requires positive amounts', () => {
    const result = parseAirdrop1155(`0x1111111111111111111111111111111111111111,0`);
    expect(result.recipients).toHaveLength(0);
    expect(result.errors[0]).toMatch(/at least 1/);
  });
});
