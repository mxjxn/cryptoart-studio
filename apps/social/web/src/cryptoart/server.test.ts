import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createFeedService, farcasterAccountMiddleware } from './server';

const makeCast = (i: number, channel = 'anywhere') => ({
  hash: `hash-${i}`,
  timestamp: new Date(Date.now() - 5000 - i * 1000).toISOString(),
  text: 'hello',
  author: { fid: i + 1, username: `user${i}` },
  channel: { id: channel },
  reactions: { likes_count: i, likes: [] },
  replies: { count: 0 },
});
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('feed adapter', () => {
  it('loads the curated Hypersnap stream for guests', async () => {
    const mock = vi.fn(async (url: URL | RequestInfo) => {
      expect(String(url)).toContain('/feed/trending');
      return json({ casts: [makeCast(0), makeCast(1)], next: { cursor: null } });
    });
    const service = createFeedService(undefined, mock as typeof fetch, null);
    const result = await service.page(new URL('http://localhost/api/cryptoart/feed'));
    expect(result.status).toBe(200);
    expect(result.body.mode).toBe('curated');
    expect(result.body.items?.length).toBe(2);
    expect(mock).toHaveBeenCalled();
  });

  it('mixes following with curated when a viewer fid is present', async () => {
    const mock = vi.fn(async (url: URL | RequestInfo) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith('/feed/trending')) {
        return json({ casts: [makeCast(0, 'news')], next: { cursor: null } });
      }
      expect(parsed.pathname.endsWith('/feed')).toBe(true);
      expect(parsed.searchParams.get('fid')).toBe('4905');
      return json({ casts: [makeCast(10, 'friends')], next: { cursor: null } });
    });
    const service = createFeedService(undefined, mock as typeof fetch, null);
    const result = await service.page(new URL('http://localhost/api/cryptoart/feed?fid=4905'));
    expect(result.status).toBe(200);
    expect(result.body.mode).toBe('mixed');
    expect(result.body.items?.map((item: { candidate: { hash: string } }) => item.candidate.hash).sort()).toEqual(['hash-0', 'hash-10']);
    expect(mock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects a malformed cursor and an invalid fid without a provider request', async () => {
    const mock = vi.fn();
    const service = createFeedService('key', mock, null);
    expect((await service.page(new URL('http://localhost/?cursor=garbage'))).status).toBe(400);
    expect((await service.page(new URL('http://localhost/?fid=nope'))).status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
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
