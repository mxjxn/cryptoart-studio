import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getConfiguredContracts,
  parseBlockEnv,
  resolveFactoryStartBlock,
  resolveStartBlock,
} from './contracts';

const touched = [
  'CHAIN_8453_RPC_URL',
  'CHAIN_84532_RPC_URL',
  'CHAIN_1_RPC_URL',
  'CHAIN_8453_START_BLOCK',
  'CHAIN_84532_START_BLOCK',
  'CHAIN_1_START_BLOCK',
  'CHAIN_8453_FACTORY_START_BLOCK',
  'CHAIN_84532_FACTORY_START_BLOCK',
];

afterEach(() => {
  for (const key of touched) delete process.env[key];
  vi.restoreAllMocks();
});

describe('parseBlockEnv', () => {
  it('treats unset and empty as unset', () => {
    expect(parseBlockEnv('CHAIN_8453_START_BLOCK')).toEqual({ kind: 'unset' });
    process.env.CHAIN_8453_START_BLOCK = '  ';
    expect(parseBlockEnv('CHAIN_8453_START_BLOCK')).toEqual({ kind: 'unset' });
  });

  it('parses a positive integer', () => {
    process.env.CHAIN_8453_START_BLOCK = ' 123 ';
    expect(parseBlockEnv('CHAIN_8453_START_BLOCK')).toEqual({ kind: 'ok', value: 123n });
  });

  it.each(['abc', '12.5', '-5', '0', '1e6', '0x10'])('rejects %s with a logged error instead of throwing', (raw) => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.CHAIN_8453_START_BLOCK = raw;
    expect(parseBlockEnv('CHAIN_8453_START_BLOCK')).toEqual({ kind: 'invalid' });
    expect(err).toHaveBeenCalledOnce();
  });
});

describe('resolveStartBlock (marketplace)', () => {
  it('uses the hard-coded block when env is unset', () => {
    expect(resolveStartBlock(8453, 38886000n)).toBe(38886000n);
  });

  it('allows env to move the start earlier', () => {
    process.env.CHAIN_8453_START_BLOCK = '38000000';
    expect(resolveStartBlock(8453, 38886000n)).toBe(38000000n);
  });

  it('never moves the start later than the hard-coded block', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.CHAIN_8453_START_BLOCK = '40000000';
    expect(resolveStartBlock(8453, 38886000n)).toBe(38886000n);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('requires env when there is no hard-coded block', () => {
    expect(resolveStartBlock(84532, 0n)).toBeNull();
    process.env.CHAIN_84532_START_BLOCK = '20000000';
    expect(resolveStartBlock(84532, 0n)).toBe(20000000n);
  });

  it('skips the chain on an invalid value', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.CHAIN_8453_START_BLOCK = 'oops';
    expect(resolveStartBlock(8453, 38886000n)).toBeNull();
  });

  it('ignores the factory start block', () => {
    process.env.CHAIN_8453_FACTORY_START_BLOCK = '40000000';
    expect(resolveStartBlock(8453, 38886000n)).toBe(38886000n);
  });
});

describe('resolveFactoryStartBlock', () => {
  it('reads only CHAIN_<id>_FACTORY_START_BLOCK', () => {
    process.env.CHAIN_8453_START_BLOCK = '38000000';
    expect(resolveFactoryStartBlock(8453)).toBeNull();
    process.env.CHAIN_8453_FACTORY_START_BLOCK = '40000000';
    expect(resolveFactoryStartBlock(8453)).toBe(40000000n);
  });

  it('returns null on an invalid value', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.CHAIN_8453_FACTORY_START_BLOCK = '-1';
    expect(resolveFactoryStartBlock(8453)).toBeNull();
  });
});

describe('getConfiguredContracts', () => {
  it('skips a chain with a bad start block without throwing and keeps the others', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.CHAIN_8453_RPC_URL = 'http://base';
    process.env.CHAIN_84532_RPC_URL = 'http://sepolia';
    process.env.CHAIN_84532_START_BLOCK = 'not-a-number';
    const chains = getConfiguredContracts().map((c) => c.chainId);
    expect(chains).toContain(8453);
    expect(chains).not.toContain(84532);
  });
});
