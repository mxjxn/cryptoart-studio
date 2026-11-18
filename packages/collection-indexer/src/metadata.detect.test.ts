import { describe, expect, it } from 'vitest';
import { audioSourceFromMetadata, detectNftMediaType, modelSourceFromMetadata } from '@cryptoart/media';

describe('collection metadata audio detection', () => {
  it('marks studio-style audio metadata', () => {
    const metadata = {
      name: 'Loop',
      image: 'ar://cover',
      animation_url: 'ar://player',
      cryptoart: { mediaType: 'audio' },
      properties: {
        category: 'audio',
        files: [{ uri: 'ar://audio', type: 'audio/mpeg', size: 1000 }],
      },
    };
    expect(detectNftMediaType(metadata)).toBe('audio');
    expect(audioSourceFromMetadata(metadata)).toBe('ar://audio');
  });

  it('marks studio-style model metadata', () => {
    const metadata = {
      name: 'Mesh',
      image: 'ar://cover',
      animation_url: 'ar://viewer',
      cryptoart: { mediaType: 'model', format: 'glb' },
      properties: {
        category: 'model',
        files: [{ uri: 'ar://glb', type: 'model/gltf-binary', size: 2000 }],
      },
    };
    expect(detectNftMediaType(metadata)).toBe('model');
    expect(modelSourceFromMetadata(metadata)).toBe('ar://glb');
  });
});