import { describe, expect, it } from 'vitest';
import { mintTokenUri } from './tokenUri';

const confirmed = { metadataUri: 'ar://meta', mintEnabled: true };

describe('mintTokenUri', () => {
  it('uses the pin metadata URI only after the pin is confirmed', () => {
    expect(mintTokenUri({ jobId: 'job-1', pin: confirmed, devMetadataUri: 'ar://other' })).toBe('ar://meta');
    expect(mintTokenUri({
      jobId: 'job-1',
      pin: { metadataUri: 'ar://meta', mintEnabled: false },
      devMetadataUri: 'ar://other',
    })).toBeNull();
    expect(mintTokenUri({ jobId: 'job-1', pin: null, devMetadataUri: 'https://example.test/meta.json' })).toBeNull();
  });

  it('keeps an ar or https query value only when there is no job', () => {
    expect(mintTokenUri({ jobId: null, pin: null, devMetadataUri: 'ar://dev' })).toBe('ar://dev');
    expect(mintTokenUri({ jobId: '  ', pin: null, devMetadataUri: 'https://example.test/m.json' })).toBe(
      'https://example.test/m.json',
    );
    expect(mintTokenUri({ jobId: null, pin: null, devMetadataUri: 'ipfs://cid' })).toBeNull();
    expect(mintTokenUri({ jobId: null, pin: confirmed, devMetadataUri: null })).toBeNull();
  });
});
