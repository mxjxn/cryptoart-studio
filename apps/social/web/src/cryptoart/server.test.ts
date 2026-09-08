import { describe, expect, it, vi } from 'vitest';
import { createFeedService } from './server';

const makeCast = (i: number) => ({ hash: `hash-${i}`, timestamp: new Date(Date.now() - i * 1000).toISOString(),
  text: 'art', author: { fid: i + 1 }, channel: { id: 'cryptoart' }, reactions: { likes_count: i } });
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
describe('feed adapter', () => {
  it('reports missing configuration without fabricating feed content', async () => {
    const service = createFeedService(undefined);
    expect((await service.page(new URL('http://localhost/api/cryptoart/feed'))).status).toBe(503);
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
    const service = createFeedService('test-key', mock as typeof fetch);
    const first = await service.page(new URL('http://localhost/api/cryptoart/feed?channel=cryptoart'));
    expect(first.status).toBe(200);
    if (!first.body.items) throw new Error('Expected feed');
    expect(first.body.items[0].candidate.hash).toBe('hash-0');
    expect(first.body.items[0].candidate.cast.viewerContext).toBeUndefined();
    const second = await service.page(new URL(`http://localhost/api/cryptoart/feed?channel=cryptoart&cursor=${first.body.nextCursor}`));
    if (!second.body.items) throw new Error('Expected second page');
    const all = [...first.body.items, ...second.body.items].map(item => item.candidate.hash);
    expect(new Set(all).size).toBe(45); expect(mock).toHaveBeenCalledTimes(2);
  });
  it('rejects unapproved channels and malformed cursors without a provider request', async () => {
    const mock = vi.fn(); const service = createFeedService('key', mock);
    expect((await service.page(new URL('http://localhost/?channel=outside'))).status).toBe(400);
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
      const service = createFeedService('key', mock as typeof fetch);
      const first = await service.page(new URL('http://localhost/?channel=cryptoart'));
      if (!first.body.items) throw new Error('Expected first page');
      clock.mockReturnValue(start + 61000);
      await service.page(new URL('http://localhost/?channel=cryptoart'));
      const continuation = await service.page(new URL(`http://localhost/?channel=cryptoart&cursor=${first.body.nextCursor}`));
      expect(continuation.status).toBe(200);
      if (!continuation.body.items) throw new Error('Expected continuation');
      expect(new Set([...first.body.items, ...continuation.body.items].map(i => i.candidate.hash)).size).toBe(45);
    } finally { clock.mockRestore(); }
  });
  it('reports failed curation lookups while retaining the ordinary feed', async () => {
    const mock = vi.fn(async (url: URL | RequestInfo) => String(url).includes('feed/channels')
      ? json({ casts: [makeCast(0)] }) : new Response('', { status: 503 }));
    const result = await createFeedService('key', mock as typeof fetch).page(new URL('http://localhost/?channel=cryptoart'));
    if (!result.body.items) throw new Error('Expected degraded feed');
    expect(result.body.warnings).toHaveLength(1); expect(result.body.items[0].score.curation).toBe(0);
  });
});
