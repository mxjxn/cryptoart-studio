import { describe, expect, it } from 'vitest';
import { mergePreviewFallback, parseGenerativeUrlOverrides, pseudoSeedFromPreview } from './preview';

describe('parseGenerativeUrlOverrides', () => {
  it('detects preview query params', () => {
    const src = parseGenerativeUrlOverrides('https://arweave.net/abc?cryptoart_preview=1&seed=0x01&param.hue=42');
    expect(src.mode).toBe('preview');
    expect(src.seed).toBe('0x01');
    expect(src.params?.hue).toBe('42');
  });
});

describe('preview fallback', () => {
  it('is deterministic for the same preview input', () => {
    const a = pseudoSeedFromPreview({ tokenId: 7, params: { hue: 12 } });
    const b = pseudoSeedFromPreview({ tokenId: 7, params: { hue: 12 } });
    expect(a).toBe(b);
  });

  it('merges studio preview values', () => {
    const merged = mergePreviewFallback({ mode: 'live' } as const, { tokenId: 3, seed: '0xabc' });
    expect(merged.tokenId).toBe('3');
    expect(merged.seed).toBe('0xabc');
  });
});