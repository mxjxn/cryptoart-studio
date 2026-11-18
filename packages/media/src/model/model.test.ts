import { describe, expect, it } from 'vitest';
import { detectNftMediaType, modelSourceFromMetadata } from '../detect';
import { buildModelNftMetadata, quoteModelPinBundle } from './metadata';
import { buildModelViewerHtml } from './viewer';
import { assertSelfContainedGltf, viewerEngineForFileName } from './validate';
import { guessModelMimeType, isModelUpload } from './mime';

describe('model mime', () => {
  it('detects glb and obj uploads', () => {
    expect(guessModelMimeType('mesh.glb', '')).toBe('model/gltf-binary');
    expect(isModelUpload('sculpt.obj', 'application/octet-stream')).toBe(true);
  });
});

describe('buildModelNftMetadata', () => {
  it('sets image, animation_url, cryptoart.mediaType, and properties.files', () => {
    const metadata = buildModelNftMetadata({
      name: 'Shape',
      modelUri: 'ar://abc',
      modelMime: 'model/gltf-binary',
      modelSha256: 'dead',
      modelSize: 1200,
      modelFormat: 'glb',
      viewerUri: 'ar://viewer',
      imageUri: 'ar://cover',
    });
    expect(metadata.cryptoart.mediaType).toBe('model');
    expect(metadata.animation_url).toBe('ar://viewer');
    expect(metadata.properties.files[0]?.type).toBe('model/gltf-binary');
    expect(metadata.properties.category).toBe('model');
  });
});

describe('buildModelViewerHtml', () => {
  it('uses model-viewer for glb and three for obj', () => {
    const glb = buildModelViewerHtml({
      title: 'A',
      modelUrl: 'https://arweave.net/x',
      format: 'glb',
      engine: 'model-viewer',
    });
    expect(glb).toContain('model-viewer');
    const obj = buildModelViewerHtml({
      title: 'B',
      modelUrl: 'https://arweave.net/y',
      format: 'obj',
      engine: 'three',
    });
    expect(obj).toContain('OBJLoader');
  });
});

describe('assertSelfContainedGltf', () => {
  it('rejects external buffer URIs', () => {
    const json = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: 'mesh.bin' }],
    });
    expect(() => assertSelfContainedGltf(new TextEncoder().encode(json), 'x.gltf')).toThrow(/Multi-file/);
  });
});

describe('detectNftMediaType', () => {
  it('reads cryptoart.mediaType model and properties.files', () => {
    expect(detectNftMediaType({ cryptoart: { mediaType: 'model' } })).toBe('model');
    expect(detectNftMediaType({
      properties: { files: [{ uri: 'ar://m', type: 'model/gltf-binary' }] },
    })).toBe('model');
    expect(detectNftMediaType({ cryptoart: { mediaType: 'generative' } })).toBe('generative');
  });
});

describe('modelSourceFromMetadata', () => {
  it('returns the model file uri', () => {
    expect(modelSourceFromMetadata({
      properties: { files: [{ uri: 'ar://glb', type: 'model/gltf-binary' }] },
    })).toBe('ar://glb');
  });
});

describe('quoteModelPinBundle', () => {
  it('sums four turbo items', async () => {
    const source = async (bytes: number) => ({ winston: String(bytes), usd: bytes * 0.000001, source: 'turbo' as const });
    const cost = await quoteModelPinBundle(500_000, 0, source);
    expect(Number(cost.usd)).toBeGreaterThan(0);
  });
});

describe('viewerEngineForFileName', () => {
  it('picks three.js only for obj and fbx', () => {
    expect(viewerEngineForFileName('a.glb')).toBe('model-viewer');
    expect(viewerEngineForFileName('a.fbx')).toBe('three');
  });
});