import { describe, expect, it, vi } from 'vitest';
import {
  createSnapchainSubmitClient,
  getComposeReadiness,
  resolveSubmitUrl,
} from './snapchainSubmit';

describe('resolveSubmitUrl', () => {
  it('joins base and default submit path', () => {
    expect(resolveSubmitUrl({ baseUrl: 'https://validator.example.com/' })).toBe(
      'https://validator.example.com/v1/submitMessage',
    );
  });

  it('returns null when base is missing', () => {
    expect(resolveSubmitUrl({ baseUrl: '  ' })).toBeNull();
  });
});

describe('getComposeReadiness', () => {
  it('gates publish until submit URL and signer flag are set', () => {
    const gated = getComposeReadiness({ HYPERSNAP_BASE_URL: 'https://haatz.example/v2/farcaster' });
    expect(gated.canPublish).toBe(false);
    expect(gated.submitConfigured).toBe(false);
    expect(gated.blockers.length).toBeGreaterThan(0);

    const ready = getComposeReadiness({
      HYPERSNAP_BASE_URL: 'https://haatz.example/v2/farcaster',
      SNAPCHAIN_SUBMIT_URL: 'https://validator.example.com',
      CRYPTOART_SIGNER_READY: 'true',
      CRYPTOART_APP_FID: '123',
    });
    expect(ready.canPublish).toBe(true);
    expect(ready.submitBaseUrl).toBe('https://validator.example.com');
  });
});

describe('createSnapchainSubmitClient', () => {
  it('POSTs octet-stream bytes to the submit URL', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ hash: '0xabc' }), { status: 200 }));
    const client = createSnapchainSubmitClient({
      baseUrl: 'https://validator.example.com',
      authorization: 'Bearer test',
      fetchImpl: fetchImpl as typeof fetch,
    });
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const result = await client.submitMessageBytes(bytes);
    expect(result).toEqual({ ok: true, body: { hash: '0xabc' } });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://validator.example.com/v1/submitMessage',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/octet-stream',
          authorization: 'Bearer test',
        }),
      }),
    );
  });

  it('returns 503 when submit URL is not configured', async () => {
    const client = createSnapchainSubmitClient({});
    const result = await client.submitMessageBytes(new Uint8Array([1]));
    expect(result).toMatchObject({ ok: false, status: 503 });
  });
});
