import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createFeedService, farcasterAccountMiddleware } from './server';

const makeCast = (i: number) => ({ hash: `hash-${i}`, timestamp: new Date(Date.now() - 5000 - i * 1000).toISOString(),
  text: 'art', author: { fid: i + 1 }, channel: { id: 'cryptoart' }, reactions: { likes_count: i } });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
describe('feed adapter', () => {
  it('reads the public Hypersnap node without an API key', async () => {
    const mock = vi.fn(async (url: URL | RequestInfo) => {
      expect(String(url).startsWith('https://haatz.quilibrium.com/v2/farcaster/feed/channels/')).toBe(true);
      return json({ casts: [], next: { cursor: null } });
    });
    const service = createFeedService(undefined, mock as typeof fetch, null);
    const result = await service.page(new URL('http://localhost/api/cryptoart/feed'));
    expect(result.status).toBe(200);
    expect(result.body.items).toEqual([]);
    expect(result.body.warnings).toEqual(['Hypersnap returned no casts for this stream.']);
    expect(mock).toHaveBeenCalled();
  });
  it('ranks explicit curator likes without leaking curator viewer state and pages a frozen snapshot', async () => {
    const casts = Array.from({ length: 45 }, (_, i) => makeCast(i));
    const mock = vi.fn(async (url: URL | RequestInfo) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.includes('feed/channels')) return json({ casts, next: { cursor: null } });
      expect(parsed.pathname).toBe('/v2/farcaster/casts/');
      expect(parsed.searchParams.get('viewer_fid')).toBe('4905');
      return json({ result: { casts: casts.map(c => ({ ...c, viewer_context: { liked: c.hash === 'hash-0' } })) } });
    });
    const service = createFeedService('test-key', mock as typeof fetch, null);
    const first = await service.page(new URL('http://localhost/api/cryptoart/feed'));
    expect(first.status).toBe(200);
    if (!first.body.items) throw new Error('Expected feed');
    expect(first.body.items[0].candidate.hash).toBe('hash-0');
    expect(first.body.items[0].candidate.cast.viewerContext).toBeUndefined();
    const second = await service.page(new URL(`http://localhost/api/cryptoart/feed?cursor=${first.body.nextCursor}`));
    if (!second.body.items) throw new Error('Expected second page');
    const all = [...first.body.items, ...second.body.items].map(item => item.candidate.hash);
    expect(new Set(all).size).toBe(45); expect(mock.mock.calls.filter(call => String(call[0]).includes('/casts/'))).toHaveLength(1);
  });
  it('rejects channel browsing and malformed cursors without a provider request', async () => {
    const mock = vi.fn(); const service = createFeedService('key', mock, null);
    expect((await service.page(new URL('http://localhost/?channel=outside'))).status).toBe(400);
    expect((await service.page(new URL('http://localhost/?channel=cryptoart'))).body).toEqual({ error: 'The feed is one stream.' });
    expect((await service.page(new URL('http://localhost/?cursor=garbage'))).status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });
  it('retains old pagination when another reader refreshes the feed', async () => {
    const clock = vi.spyOn(Date, 'now');
    const start = Date.now();
    const casts = Array.from({ length: 45 }, (_, i) => makeCast(i));
    const mock = vi.fn(async (url: URL | RequestInfo) => String(url).includes('feed/channels')
      ? json({ casts }) : json({ result: { casts } }));
    try {
      clock.mockReturnValue(start);
      const service = createFeedService('key', mock as typeof fetch, null);
      const first = await service.page(new URL('http://localhost/'));
      if (!first.body.items) throw new Error('Expected first page');
      clock.mockReturnValue(start + 61000);
      await service.page(new URL('http://localhost/'));
      const continuation = await service.page(new URL(`http://localhost/?cursor=${first.body.nextCursor}`));
      expect(continuation.status).toBe(200);
      if (!continuation.body.items) throw new Error('Expected continuation');
      expect(new Set([...first.body.items, ...continuation.body.items].map(i => i.candidate.hash)).size).toBe(45);
    } finally { clock.mockRestore(); }
  });
  it('reports failed curation lookups while retaining the ordinary feed', async () => {
    const mock = vi.fn(async (url: URL | RequestInfo) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.includes('feed/channels')) {
        const channel = parsed.searchParams.get('channel_ids') ?? 'cryptoart';
        return json({ casts: [{ ...makeCast(0), channel: { id: channel } }] });
      }
      return new Response('', { status: 503 });
    });
    const result = await createFeedService('key', mock as typeof fetch, null).page(new URL('http://localhost/'));
    if (!result.body.items) throw new Error('Expected degraded feed');
    expect(result.body.warnings).toHaveLength(1); expect(result.body.items[0].score.curation).toBe(0);
  });
});

describe('wallet directory', () => {
  it('returns the listed username and does not forward an API key', async () => {
    const request = vi.fn(async () => json({
      users: [{ fid: 4905, username: 'mxjxn', display_name: 'Max Jackson', custody_address: '0x0e43a2acb2fb3d9baa5222b183e0432bee2c65ab', verifications: [] }],
    }));
    const handler = farcasterAccountMiddleware({ request: request as typeof fetch, baseUrl: 'https://haatz.quilibrium.com/v2/farcaster' });
    const req = { method: 'GET', url: '/api/cryptoart/account?address=0x0e43a2acb2fb3d9baa5222b183e0432bee2c65ab' } as IncomingMessage;
    let body = '';
    const res = { statusCode: 0, setHeader() {}, end(value: string) { body = value; } } as unknown as ServerResponse;
    await handler(req, res, () => { throw new Error('next'); });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(body)).toMatchObject({ fid: 4905, username: 'mxjxn' });
    expect(request.mock.calls[0][1].headers).toBeUndefined();
  });

  it('misses quietly when the address is not listed', async () => {
    const request = vi.fn(async () => json({ users: [] }));
    const handler = farcasterAccountMiddleware({ request: request as typeof fetch });
    const req = { method: 'GET', url: '/api/cryptoart/account?address=0x0000000000000000000000000000000000000001' } as IncomingMessage;
    let body = '';
    const res = { statusCode: 0, setHeader() {}, end(value: string) { body = value; } } as unknown as ServerResponse;
    await handler(req, res, () => { throw new Error('next'); });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(body)).toEqual({ account: null });
  });
});
