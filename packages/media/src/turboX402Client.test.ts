import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  buildTurboRawX402Post,
  DEFAULT_TURBO_UPLOAD_URL,
  parseTurboUploadResponse,
  TURBO_X402_UNSIGNED_PATH,
  uploadRawTurboX402FromBrowser,
} from './turboX402Client';

describe('turbo raw x402 POST shape', () => {
  it('targets the unsigned data-item endpoint with octet-stream and tag header', () => {
    const data = new Uint8Array([1, 2, 3]);
    const post = buildTurboRawX402Post({
      data,
      tags: [{ name: 'Content-Type', value: 'image/png' }],
    });
    expect(post.url).toBe(`${DEFAULT_TURBO_UPLOAD_URL}${TURBO_X402_UNSIGNED_PATH}`);
    expect(post.method).toBe('POST');
    expect(post.headers['content-type']).toBe('application/octet-stream');
    expect(JSON.parse(post.headers['x-data-item-tags']!)).toEqual([{ name: 'Content-Type', value: 'image/png' }]);
    expect(post.bodyByteLength).toBe(3);
  });

  it('strips trailing slashes from a custom upload host', () => {
    const post = buildTurboRawX402Post({
      data: new Uint8Array([0]),
      uploadServiceUrl: 'https://upload.example.com///',
    });
    expect(post.url).toBe(`https://upload.example.com${TURBO_X402_UNSIGNED_PATH}`);
  });

  it('parses nested receipt ids from Turbo responses', () => {
    expect(parseTurboUploadResponse({ id: 'abc123' }).id).toBe('abc123');
    expect(parseTurboUploadResponse({ receipt: { id: 'nested' } }).id).toBe('nested');
    expect(() => parseTurboUploadResponse({})).toThrow(/transaction id/i);
  });
});

describe('uploadRawTurboX402FromBrowser', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.stubGlobal('window', { document: {} });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalWindow === undefined) {
      // @ts-expect-error cleanup
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  });

  it('refuses to run without a browser window', async () => {
    vi.stubGlobal('window', undefined);
    await expect(uploadRawTurboX402FromBrowser({
      data: new Uint8Array([1]),
      network: 'eip155:8453',
      walletClient: {},
      maxUsdcAtomic: 1000n,
    })).rejects.toThrow(/browser-only/i);
  });
});