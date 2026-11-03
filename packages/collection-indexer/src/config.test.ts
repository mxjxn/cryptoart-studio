import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getConfig } from './config.js';

const ORIGINAL = { ...process.env };

describe('indexer getConfig multi-factory', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL };
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('expands erc721 and erc1155 factories for the same chain', () => {
    process.env.CHAIN_IDS = '8453';
    process.env.CHAIN_8453_RPC_URL = 'https://example.invalid';
    process.env.CHAIN_8453_FACTORY_ADDRESS = '0x1111111111111111111111111111111111111111';
    process.env.CHAIN_8453_ERC1155_FACTORY_ADDRESS = '0x2222222222222222222222222222222222222222';
    process.env.CHAIN_8453_START_BLOCK = '123';

    const config = getConfig();
    expect(config.chains).toHaveLength(2);
    expect(config.chains.map((c) => c.tokenStandard).sort()).toEqual(['erc1155', 'erc721']);
    expect(config.chains.every((c) => c.startBlock === 123)).toBe(true);
  });

  it('allows erc1155-only configuration', () => {
    process.env.CHAIN_IDS = '1';
    process.env.CHAIN_1_RPC_URL = 'https://example.invalid';
    process.env.CHAIN_1_ERC1155_FACTORY_ADDRESS = '0x3333333333333333333333333333333333333333';

    const config = getConfig();
    expect(config.chains).toHaveLength(1);
    expect(config.chains[0]?.tokenStandard).toBe('erc1155');
  });
});
