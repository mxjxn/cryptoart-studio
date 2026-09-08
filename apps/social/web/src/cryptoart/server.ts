import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { APPROVED_CHANNELS, FEATURED_AUCTIONS, FEED_POLICY, isApprovedChannel, RECENT_SALE_EXAMPLES } from './policy';
import { normalizeCast, type NeynarCast } from './neynar';
import { rankFeed } from './ranking';
import { fetchAuctionCard, type AuctionCardData } from './marketplace';

type Snapshot = { id: string; createdAt: number; items: ReturnType<typeof rankFeed<ReturnType<typeof normalizeCast>>>;
  auctions: AuctionCardData[]; warnings: string[] };
type Fetch = typeof fetch;

/** This first read adapter runs in local Vite/preview. Production hosting is a separate milestone. */
export function createFeedService(apiKey: string | undefined, request: Fetch = fetch, marketplaceRequest: Fetch | null = request) {
  const snapshots = new Map<string, Snapshot>();
  const retained = new Map<string, { key: string; snapshot: Snapshot }>();
  const pending = new Map<string, Promise<Snapshot>>();
  const maxPages = 10;
  async function get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`https://api.neynar.com/v2/farcaster/${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await request(url, { headers: { 'x-api-key': apiKey! }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Farcaster data provider returned ${response.status}`);
    return await response.json() as T;
  }

  async function collect(channel: string, now: number) {
    let cursor = '';
    const casts = new Map<string, NeynarCast>();
    for (let page = 0; page < maxPages; page++) {
      const data = await get<{ casts: NeynarCast[]; next?: { cursor?: string | null } }>('feed/channels/', {
        channel_ids: channel, limit: '100', with_recasts: 'false', with_replies: 'false', ...(cursor ? { cursor } : {}),
      });
      if (!Array.isArray(data.casts)) throw new Error('Invalid channel feed response');
      for (const cast of data.casts) {
        if (cast.channel?.id === channel && !cast.parent_hash && Date.parse(cast.timestamp) <= now) casts.set(cast.hash, cast);
      }
      const next = data.next?.cursor;
      const reachedWindow = data.casts.length > 0 && data.casts.every(c => Date.parse(c.timestamp) < now - FEED_POLICY.popularWindowMs);
      if (!next || !data.casts.length || reachedWindow) return { casts: [...casts.values()], truncated: false };
      if (next === cursor) break;
      cursor = next;
    }
    return { casts: [...casts.values()], truncated: true };
  }

  async function build(channels: readonly string[]) {
    const now = Date.now();
    const warnings: string[] = [];
    const collected = await Promise.allSettled(channels.map(channel => collect(channel, now)));
    const raw = new Map<string, NeynarCast>();
    collected.forEach((result, index) => {
      if (result.status === 'rejected') warnings.push(`/${channels[index]} could not be loaded.`);
      else {
        if (result.value.truncated) warnings.push(`/${channels[index]} reached the candidate limit; popularity coverage is partial.`);
        result.value.casts.forEach(cast => raw.set(cast.hash, cast));
      }
    });
    if (collected.every(result => result.status === 'rejected')) throw new Error('Approved channels could not be loaded. Check the server API key and provider access.');
    const liked = new Map<string, number[]>();
    const hashes = [...raw.keys()];
    for (const fid of Object.keys(FEED_POLICY.weightedLikes)) {
      try {
        for (let i = 0; i < hashes.length; i += 100) {
          const data = await get<{ result: { casts: NeynarCast[] } }>('casts/', { casts: hashes.slice(i, i + 100).join(','), viewer_fid: fid });
          if (!Array.isArray(data.result?.casts)) throw new Error('Invalid reaction response');
          for (const cast of data.result.casts) {
            if (cast.viewer_context?.liked === true) liked.set(cast.hash, [...(liked.get(cast.hash) ?? []), Number(fid)]);
          }
        }
      } catch {
        warnings.push(`Weighted likes for FID ${fid} are incomplete for this snapshot.`);
      }
    }
    const auctionResults = marketplaceRequest ? await Promise.allSettled([
      ...FEATURED_AUCTIONS.map(ref => fetchAuctionCard(ref, 'featured-auction', marketplaceRequest)),
      ...RECENT_SALE_EXAMPLES.map(ref => fetchAuctionCard(ref, 'recent-sale', marketplaceRequest)),
    ]) : [];
    const auctions: AuctionCardData[] = [];
    auctionResults.forEach((result, index) => {
      if (result.status === 'fulfilled') auctions.push(result.value);
      else warnings.push(index < FEATURED_AUCTIONS.length
        ? 'A featured auction could not be verified.'
        : 'A recent sale could not be verified.');
    });
    return { id: randomUUID(), createdAt: now, warnings, auctions,
      items: rankFeed([...raw.values()].map(cast => normalizeCast(cast, liked.get(cast.hash))), now) };
  }

  async function page(url: URL) {
    if (!apiKey) return { status: 503, body: { error: 'Configure NEYNAR_API_KEY on the Social server to load the feed.' } };
    const channel = url.searchParams.get('channel');
    if (channel && !isApprovedChannel(channel)) return { status: 400, body: { error: 'Channel is not approved.' } };
    const key = channel ?? 'all';
    const cursor = url.searchParams.get('cursor');
    let offset = 0;
    let snapshot: Snapshot | undefined;
    if (cursor) {
      const match = /^([a-f0-9-]{36}):(\d+)$/.exec(cursor);
      if (!match) return { status: 400, body: { error: 'Invalid feed cursor.' } };
      const previous = retained.get(match[1]);
      snapshot = previous?.key === key ? previous.snapshot : undefined;
      offset = Number(match[2]);
      if (!Number.isSafeInteger(offset) || offset % 30 !== 0) return { status: 400, body: { error: 'Invalid feed offset.' } };
      if (!snapshot || snapshot.id !== match[1] || Date.now() - snapshot.createdAt > 600000) {
        return { status: 409, body: { error: 'This feed snapshot expired. Refresh to load new casts.' } };
      }
    } else {
      snapshot = snapshots.get(key);
      if (!snapshot || Date.now() - snapshot.createdAt > 60000) {
        let building = pending.get(key);
        if (!building) {
          building = build(channel ? [channel] : APPROVED_CHANNELS).finally(() => pending.delete(key));
          pending.set(key, building);
        }
        snapshot = await building;
        snapshots.set(key, snapshot);
        retained.set(snapshot.id, { key, snapshot });
        for (const [id, entry] of retained) {
          if (Date.now() - entry.snapshot.createdAt > 600000) retained.delete(id);
        }
      }
    }
    const items = snapshot.items.slice(offset, offset + 30);
    return { status: 200, body: { items, auctions: offset === 0 ? snapshot.auctions : [], warnings: snapshot.warnings, snapshotAt: snapshot.createdAt,
      nextCursor: offset + 30 < snapshot.items.length ? `${snapshot.id}:${offset + 30}` : null } };
  }

  return { page };
}

export function feedMiddleware(apiKey?: string) {
  const service = createFeedService(apiKey);
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/cryptoart/feed') return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed' })); return; }
    try {
      const result = await service.page(url);
      res.statusCode = result.status; res.end(JSON.stringify(result.body));
    } catch {
      res.statusCode = 502; res.end(JSON.stringify({ error: 'Farcaster feed is unavailable. Check provider access and try again.' }));
    }
  };
}
