import { describe, expect, it } from 'vitest';
import { parseTokenUrl } from './tokenUrls';

describe('parseTokenUrl', () => {
  it('parses chain CAIP-19 URIs', () => {
    const token = parseTokenUrl('chain://eip155:1/erc721:0xcc3cac6d9f77681cbff754377ad4599f5d8afd30/37');
    expect(token?.tokenId).toBe('37');
    expect(token?.chainId).toBe(1);
  });
  it('parses OpenSea item URLs', () => {
    const token = parseTokenUrl('https://opensea.io/assets/ethereum/0xabc1234567890123456789012345678901234567/12');
    expect(token?.tokenId).toBe('12');
  });
  it('parses Zora collect URLs', () => {
    const token = parseTokenUrl('https://zora.co/collect/base:0xabc1234567890123456789012345678901234567/3');
    expect(token?.label).toContain('Zora');
  });
});