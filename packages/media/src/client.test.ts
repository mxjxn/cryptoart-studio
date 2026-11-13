import { describe, expect, it, vi } from 'vitest';
import { MediaClient, tokenUriFromMetadata, arweaveGatewayUrls, buildTempUploadPathname } from './client';

describe('MediaClient', () => {
  it('builds correct API URLs and includes credentials', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'test' }),
    });

    const client = new MediaClient({
      baseUrl: '/api/media',
      fetch: mockFetch,
    });

    await client.getJobStatus('test-job-id');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/media/jobs/test-job-id',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    );
  });

  it('throws error on failed request with error message', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid request' }),
    });

    const client = new MediaClient({
      baseUrl: '/api/media',
      fetch: mockFetch,
    });

    await expect(client.getJobStatus('test-job-id')).rejects.toThrow('Invalid request');
  });

  it('converts bytes to base64 correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ job: { id: 'test' }, simulated: false }),
    });

    const client = new MediaClient({
      baseUrl: '/api/media',
      fetch: mockFetch,
    });

    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    await client.uploadMedia('job-id', bytes);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/media/jobs/job-id/media',
      expect.objectContaining({
        body: JSON.stringify({ bytes: 'SGVsbG8=' }), // "Hello" in base64
      }),
    );
  });

  it('hashes file correctly', async () => {
    const client = new MediaClient({ baseUrl: '/api/media' });
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const hash = await client.hashFile(file);

    // SHA-256 of "test"
    expect(hash).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
  });
});

describe('tokenUriFromMetadata', () => {
  it('converts Arweave ID to ar:// URI', () => {
    expect(tokenUriFromMetadata({ id: 'abc123' })).toBe('ar://abc123');
  });
});

describe('arweaveGatewayUrls', () => {
  it('returns gateway URLs for a transaction ID', () => {
    const urls = arweaveGatewayUrls('abc123');
    expect(urls).toEqual([
      'https://arweave.net/abc123',
      'https://ar-io.net/abc123',
    ]);
  });
});

describe('buildTempUploadPathname', () => {
  it('lowercases a checksummed wallet address', () => {
    const path = buildTempUploadPathname('0xAbCDEF0123456789abcdef0123456789ABCDEF01', 'art.PNG');
    expect(path.startsWith('temp/0xabcdef0123456789abcdef0123456789abcdef01/')).toBe(true);
    expect(path.endsWith('.PNG')).toBe(true);
  });

  it('strips unsafe characters from the extension', () => {
    const path = buildTempUploadPathname('0xabc', 'evil.p/n..g?');
    expect(path).toMatch(/^temp\/0xabc\/\d+-[0-9a-f-]+\.g$/);
  });
});
