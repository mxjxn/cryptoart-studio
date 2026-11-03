import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { FEATURED_AUCTIONS, FEED_POLICY, RECENT_SALE_EXAMPLES } from './policy';
import { normalizeCast, type NeynarCast } from './neynar';
import { rankFeed } from './ranking';
import { fetchAuctionCard, fetchLatestListings, type AuctionCardData, type MarketplaceListingData } from './marketplace';
import { fetchMarketPage } from './marketClient';
import { createAssetDiscoveryService } from './assetDiscovery';
import { fetchFarcasterAccountByAddress } from '../../../../../packages/identity/src/farcasterDirectory';

type Snapshot = { id: string; createdAt: number; mode: 'curated' | 'mixed'; items: ReturnType<typeof rankFeed<ReturnType<typeof normalizeCast>>>;
  auctions: AuctionCardData[]; latestListings: MarketplaceListingData[]; warnings: string[] };
type Fetch = typeof fetch;

/** Public Hypersnap HTTP reads. Override with HYPERSNAP_BASE_URL for another node. */
export const HYPERSNAP_BASE_URL = 'https://haatz.quilibrium.com/v2/farcaster';

const CURATOR_FIDS = Object.keys(FEED_POLICY.weightedLikes).map(Number);

/**
 * Network-wide Hypersnap feed with marketplace cards alongside.
 * Guests get curated (trending). Known FID mixes following + curated.
 */
export function createFeedService(_apiKey: string | undefined, request: Fetch = fetch, marketplaceRequest: Fetch | null = request, baseUrl: string = HYPERSNAP_BASE_URL) {
  const snapshots = new Map<string, Snapshot>();
  const retained = new Map<string, { key: string; snapshot: Snapshot }>();
  const pending = new Map<string, Promise<Snapshot>>();

  async function collect(path: string, pages = 2): Promise<{ casts: NeynarCast[]; warning?: string }> {
    const casts: NeynarCast[] = [];
    let cursor: string | null = null;
    try {
      for (let page = 0; page < pages; page++) {
        const url = new URL(`${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`);
        url.searchParams.set('limit', '30');
        if (cursor) url.searchParams.set('cursor', cursor);
        const response = await request(url);
        if (!response.ok) return { casts, warning: `Hypersnap ${path} returned ${response.status}.` };
        const body = await response.json() as { casts?: NeynarCast[]; next?: { cursor?: string | null } };
        const batch = body.casts ?? [];
        casts.push(...batch);
        cursor = body.next?.cursor ?? null;
        if (!cursor || batch.length === 0) break;
      }
      return { casts };
    } catch {
      return { casts, warning: `Hypersnap ${path} could not be reached.` };
    }
  }

  async function build(viewerFid: number | null) {
    const now = Date.now();
    const warnings: string[] = [];
    const mode: Snapshot['mode'] = viewerFid ? 'mixed' : 'curated';

    const curated = await collect('/feed/trending');
    if (curated.warning) warnings.push(curated.warning);
    if (!curated.casts.length && !curated.warning) warnings.push('Hypersnap returned no casts for the curated stream.');

    let personal: NeynarCast[] = [];
    if (viewerFid) {
      const following = await collect(`/feed?fid=${viewerFid}`);
      if (following.warning) warnings.push(following.warning);
      personal = following.casts;
    }

    const byHash = new Map<string, NeynarCast>();
    for (const cast of [...personal, ...curated.casts]) {
      if (cast?.hash && !byHash.has(cast.hash)) byHash.set(cast.hash, cast);
    }

    const candidates = [...byHash.values()].map(raw => {
      const likerFids = (raw.reactions?.likes ?? []).map(like => like.fid).filter(fid => CURATOR_FIDS.includes(fid));
      return normalizeCast(raw, likerFids);
    });

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
    return { id: randomUUID(), createdAt: now, mode, warnings, auctions,
      latestListings,
      items: rankFeed(candidates, now) };
  }

  async function page(url: URL) {
    const fidParam = url.searchParams.get('fid');
    const viewerFid = fidParam && /^\d+$/.test(fidParam) ? Number(fidParam) : null;
    if (fidParam && viewerFid === null) return { status: 400, body: { error: 'Invalid viewer fid.' } };
    const key = viewerFid ? `feed:mixed:${viewerFid}` : 'feed:curated';
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
          building = build(viewerFid).finally(() => pending.delete(key));
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
    return { status: 200, body: {
      mode: snapshot.mode,
      items,
      auctions: offset === 0 ? snapshot.auctions : [],
      latestListings: offset === 0 ? snapshot.latestListings : [],
      warnings: snapshot.warnings,
      snapshotAt: snapshot.createdAt,
      nextCursor: offset + 30 < snapshot.items.length ? `${snapshot.id}:${offset + 30}` : null,
    } };
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
