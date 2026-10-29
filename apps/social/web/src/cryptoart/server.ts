import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { APPROVED_CHANNELS, FEATURED_AUCTIONS, FEED_POLICY, RECENT_SALE_EXAMPLES } from './policy';
import { normalizeCast, type NeynarCast } from './neynar';
import { rankFeed } from './ranking';
import { fetchAuctionCard, fetchLatestListings, type AuctionCardData, type MarketplaceListingData } from './marketplace';
import { fetchMarketPage } from './marketClient';
import { createAssetDiscoveryService } from './assetDiscovery';
import { fetchFarcasterAccountByAddress } from '../../../../../packages/identity/src/farcasterDirectory';

type Snapshot = { id: string; createdAt: number; items: ReturnType<typeof rankFeed<ReturnType<typeof normalizeCast>>>;
  auctions: AuctionCardData[]; latestListings: MarketplaceListingData[]; warnings: string[] };
type Fetch = typeof fetch;
type CastList = { casts?: NeynarCast[]; result?: { casts?: NeynarCast[] } };

/** Public Hypersnap HTTP reads. Override with HYPERSNAP_BASE_URL for another node. */
export const HYPERSNAP_BASE_URL = 'https://haatz.quilibrium.com/v2/farcaster';

function listedCasts(data: CastList): NeynarCast[] {
  const casts = data.result?.casts ?? data.casts;
  if (!Array.isArray(casts)) throw new Error('Invalid cast list response');
  return casts;
}

/** This first read adapter runs in local Vite/preview. Production hosting is a separate milestone. */
export function createFeedService(apiKey: string | undefined, request: Fetch = fetch, marketplaceRequest: Fetch | null = request, baseUrl: string = HYPERSNAP_BASE_URL) {
  const snapshots = new Map<string, Snapshot>();
  const retained = new Map<string, { key: string; snapshot: Snapshot }>();
  const pending = new Map<string, Promise<Snapshot>>();
  const maxPages = 10;
  const root = baseUrl.replace(/\/$/, '');
  async function get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${root}/${path.replace(/^\//, '')}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const headers: Record<string, string> = {};
    if (apiKey) headers['x-api-key'] = apiKey;
    const response = await request(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Farcaster data provider returned ${response.status}`);
    return await response.json() as T;
  }

  async function collect(channel: string, now: number) {
    let cursor = '';
    const casts = new Map<string, NeynarCast>();
    for (let page = 0; page < maxPages; page++) {
      const data = await get<CastList & { next?: { cursor?: string | null } }>('feed/channels/', {
        channel_ids: channel, limit: '100', with_recasts: 'false', with_replies: 'false', ...(cursor ? { cursor } : {}),
      });
      const page = listedCasts(data);
      for (const cast of page) {
        const channelId = cast.channel?.id;
        if ((channelId == null || channelId === channel) && !cast.parent_hash && Date.parse(cast.timestamp) <= now) casts.set(cast.hash, cast);
      }
      const next = data.next?.cursor;
      const reachedWindow = page.length > 0 && page.every(c => Date.parse(c.timestamp) < now - FEED_POLICY.popularWindowMs);
      if (!next || !page.length || reachedWindow) return { casts: [...casts.values()], truncated: false };
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
    let failed = 0;
    let empty = 0;
    let truncated = false;
    collected.forEach(result => {
      if (result.status === 'rejected') failed += 1;
      else {
        if (result.value.truncated) truncated = true;
        if (result.value.casts.length === 0) empty += 1;
        result.value.casts.forEach(cast => raw.set(cast.hash, cast));
      }
    });
    if (failed === collected.length) throw new Error('The conversation stream could not be loaded.');
    if (failed > 0) warnings.push('Part of the conversation stream could not be loaded.');
    if (empty === collected.length) warnings.push('Hypersnap returned no casts for this stream.');
    else if (empty > 0) warnings.push('Hypersnap returned no casts for part of this stream.');
    if (truncated) warnings.push('Popularity coverage is partial for this snapshot.');
    const liked = new Map<string, number[]>();
    const hashes = [...raw.keys()];
    for (const fid of Object.keys(FEED_POLICY.weightedLikes)) {
      try {
        for (let i = 0; i < hashes.length; i += 100) {
          const data = await get<CastList>('casts/', { casts: hashes.slice(i, i + 100).join(','), viewer_fid: fid });
          for (const cast of listedCasts(data)) {
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
    let latestListings: MarketplaceListingData[] = [];
    if (marketplaceRequest) {
      try { latestListings = await fetchLatestListings(marketplaceRequest); }
      catch { warnings.push('Latest marketplace listings could not be loaded.'); }
    }
    return { id: randomUUID(), createdAt: now, warnings, auctions,
      latestListings,
      items: rankFeed([...raw.values()].map(cast => normalizeCast(cast, liked.get(cast.hash))), now) };
  }

  async function page(url: URL) {
    if (url.searchParams.has('channel')) return { status: 400, body: { error: 'The feed is one stream.' } };
    const key = 'feed';
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
          building = build(APPROVED_CHANNELS).finally(() => pending.delete(key));
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
    return { status: 200, body: { items, auctions: offset === 0 ? snapshot.auctions : [], latestListings: offset === 0 ? snapshot.latestListings : [], warnings: snapshot.warnings, snapshotAt: snapshot.createdAt,
      nextCursor: offset + 30 < snapshot.items.length ? `${snapshot.id}:${offset + 30}` : null } };
  }

  return { page };
}

const ETH_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Public directory read. A listed username is not permission to post. */
export function farcasterAccountMiddleware(options: { baseUrl?: string; request?: Fetch } = {}) {
  const request = options.request ?? fetch;
  const baseUrl = options.baseUrl ?? HYPERSNAP_BASE_URL;
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/cryptoart/account') return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed' })); return; }
    const address = url.searchParams.get('address') ?? '';
    if (!ETH_ADDRESS.test(address)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'A wallet address is required.' })); return; }
    try {
      const account = await fetchFarcasterAccountByAddress(address, request, baseUrl);
      if (!account) { res.statusCode = 404; res.end(JSON.stringify({ account: null })); return; }
      res.statusCode = 200;
      res.end(JSON.stringify({
        fid: account.fid,
        username: account.username,
        displayName: account.displayName,
        pfpUrl: account.pfpUrl,
      }));
    } catch {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: 'Farcaster directory is unavailable.' }));
    }
  };
}

export function feedMiddleware(options: { apiKey?: string; baseUrl?: string } = {}) {
  const service = createFeedService(options.apiKey, fetch, fetch, options.baseUrl ?? HYPERSNAP_BASE_URL);
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

export function marketMiddleware(request: Fetch = fetch) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/cryptoart/market') return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    const first = Math.min(48, Math.max(1, Number(url.searchParams.get('first')) || 24));
    const skip = Math.max(0, Number(url.searchParams.get('skip')) || 0);
    try {
      const result = await fetchMarketPage({ first, skip }, request);
      res.statusCode = 200;
      res.end(JSON.stringify(result));
    } catch {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: 'Marketplace data is temporarily unavailable.' }));
    }
  };
}

export function assetDiscoveryMiddleware(apiKey?: string, request: Fetch = fetch) {
  const service = createAssetDiscoveryService(apiKey, request);
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const handler = url.pathname === '/api/cryptoart/assets/owned' ? service.owned
      : url.pathname === '/api/cryptoart/assets/import' ? service.imported : null;
    if (!handler) return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed' })); return; }
    try {
      const result = await handler(url);
      res.statusCode = result.status;
      res.end(JSON.stringify(result.body));
    } catch {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: 'NFT discovery is temporarily unavailable.' }));
    }
  };
}
