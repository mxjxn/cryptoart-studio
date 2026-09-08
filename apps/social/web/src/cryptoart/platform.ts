import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  applyCookies,
  createIdentityRouter,
  createMemoryIdentityStore,
  createPostgresIdentityStore,
  toPlatformRequest,
} from '../../../../../packages/identity/src/index';
import {
  createMediaRouter,
  createMemoryMediaStore,
  createPostgresMediaStore,
  createSimulatedArweave,
} from '../../../../../packages/media/src/index';

function headerMap(req: IncomingMessage) {
  const headers: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) headers[key] = value;
  return headers;
}

function readBody(req: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

export function createPlatformServices(env: Record<string, string | undefined>) {
  const postgresUrl = env.STORAGE_POSTGRES_URL || env.POSTGRES_URL;
  const identity = createIdentityRouter({
    store: postgresUrl ? createPostgresIdentityStore(postgresUrl) : createMemoryIdentityStore(),
    ownerAddress: env.CRYPTOART_OWNER_ADDRESS,
    secureCookies: env.HTTPS === 'true',
  });
  const media = createMediaRouter({
    store: postgresUrl ? createPostgresMediaStore(postgresUrl) : createMemoryMediaStore(),
    arweave: createSimulatedArweave(),
    payTo: env.CRYPTOART_MEDIA_PAY_TO || env.CRYPTOART_OWNER_ADDRESS || '0x0000000000000000000000000000000000000000',
    allowMockPayment: env.CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT !== 'false',
    network: env.CRYPTOART_MEDIA_NETWORK,
    asset: env.CRYPTOART_MEDIA_ASSET,
  });
  return { identity, media, durable: Boolean(postgresUrl) };
}

export function platformMiddleware(env: Record<string, string | undefined>) {
  const services = createPlatformServices(env);
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const identityPrefix = url.pathname.startsWith('/api/cryptoart/session')
      || url.pathname.startsWith('/api/cryptoart/admin')
      || url.pathname.startsWith('/api/cryptoart/exhibitions');
    const mediaPrefix = url.pathname.startsWith('/api/cryptoart/media');
    if (!identityPrefix && !mediaPrefix) return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await readBody(req);
      if (mediaPrefix) {
        const session = await services.identity.handle(toPlatformRequest({
          method: 'GET',
          url: new URL('/session', url.origin),
          headers: headerMap(req),
          body: {},
        }));
        const payer = session.status === 200 ? (session.body as { address?: string }).address : undefined;
        const result = await services.media.handle({
          method: req.method ?? 'GET',
          pathname: url.pathname.replace(/^\/api\/cryptoart\/media/, '') || '/',
          headers: Object.fromEntries(Object.entries(headerMap(req)).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])),
          body,
          payer,
        });
        res.statusCode = result.status;
        res.end(JSON.stringify(result.body));
        return;
      }
      const mapped = new URL(url.pathname.replace(/^\/api\/cryptoart/, '') + url.search, url.origin);
      const result = await services.identity.handle(toPlatformRequest({
        method: req.method ?? 'GET',
        url: mapped,
        headers: headerMap(req),
        body,
      }));
      applyCookies(result, res);
      res.statusCode = result.status;
      res.end(JSON.stringify(result.body));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Platform API failed' }));
    }
  };
}
