import { NextRequest, NextResponse } from 'next/server';
import {
  applyCookies,
  createIdentityRouter,
  createMemoryIdentityStore,
  createPostgresIdentityStore,
  SESSION_COOKIE,
  toPlatformRequest,
} from '@cryptoart/identity';
import {
  BASE_NETWORK,
  BASE_USDC,
  createHttpFacilitator,
  createMediaRouter,
  createMemoryMediaStore,
  createMockFacilitator,
  createPostgresMediaStore,
  createSimulatedArweave,
  createTurboArweave,
  createDirectArweave,
} from '@cryptoart/media';

const postgresUrl = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;
const isProd = process.env.NODE_ENV === 'production';
const isVercelProduction = process.env.VERCEL_ENV === 'production';

function resolveAllowMockPayment(): boolean {
  // Never allow mock payment in Vercel production
  if (isVercelProduction) return false;
  
  // Explicit configuration takes precedence
  if (process.env.CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT === 'true') return true;
  if (process.env.CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT === 'false') return false;
  
  // Default to false
  return false;
}

const identity = createIdentityRouter({
  store: postgresUrl ? createPostgresIdentityStore(postgresUrl) : createMemoryIdentityStore(),
  ownerAddress: process.env.CRYPTOART_OWNER_ADDRESS,
  secureCookies: isProd,
});

let mediaPromise: ReturnType<typeof createMediaRouter> | Promise<ReturnType<typeof createMediaRouter>> | null = null;

async function mediaRouter() {
  if (mediaPromise) return mediaPromise;
  mediaPromise = (async () => {
    const allowMockPayment = resolveAllowMockPayment();
    const uploaderType = process.env.ARWEAVE_UPLOADER || 'turbo';

    // Validate production requirements
    if (isVercelProduction) {
      if (uploaderType === 'turbo' && !process.env.TURBO_PRIVATE_KEY) {
        throw new Error('TURBO_PRIVATE_KEY is required in production for Turbo uploads');
      }
      if (uploaderType === 'direct' && !process.env.ARWEAVE_JWK) {
        throw new Error('ARWEAVE_JWK is required in production for direct uploads');
      }
      if (!process.env.X402_FACILITATOR_URL) {
        throw new Error('X402_FACILITATOR_URL is required in production');
      }
    }

    // Select Arweave uploader: Turbo (paid service), Direct L1, or Simulated (dev/test)
    const arweave = await (async () => {
      // On preview deployments, use simulated uploader unless explicitly configured
      const isPreview = process.env.VERCEL_ENV === 'preview';
      if (isPreview && uploaderType !== 'simulated' && !process.env.TURBO_PRIVATE_KEY && !process.env.ARWEAVE_JWK) {
        return createSimulatedArweave();
      }

      const key = process.env.TURBO_PRIVATE_KEY || process.env.ARWEAVE_JWK;
      if (!key) return createSimulatedArweave();
      
      if (uploaderType === 'direct') {
        return createDirectArweave(key);
      }
      return createTurboArweave(key);
    })();

    const facilitator = process.env.X402_FACILITATOR_URL
      ? await createHttpFacilitator(process.env.X402_FACILITATOR_URL)
      : createMockFacilitator();

    return createMediaRouter({
      store: postgresUrl ? createPostgresMediaStore(postgresUrl) : createMemoryMediaStore(),
      arweave,
      facilitator,
      payTo:
        process.env.CRYPTOART_MEDIA_PAY_TO ||
        process.env.CRYPTOART_OWNER_ADDRESS ||
        '0x0000000000000000000000000000000000000000',
      allowMockPayment,
      network: process.env.CRYPTOART_MEDIA_NETWORK || (isProd ? BASE_NETWORK : undefined),
      asset: process.env.CRYPTOART_MEDIA_ASSET || (isProd ? BASE_USDC : undefined),
    });
  })();
  return mediaPromise;
}

function headerRecord(req: NextRequest) {
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((value, key) => { headers[key] = value; });
  return headers;
}

export async function handleIdentity(req: NextRequest, prefix: string) {
  const url = new URL(req.url);
  const mapped = new URL(url.pathname.replace(prefix, '') + url.search, url.origin);
  const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await req.json().catch(() => ({}));
  const result = await identity.handle(toPlatformRequest({
    method: req.method,
    url: mapped,
    headers: { ...headerRecord(req), host: url.host },
    body,
  }));
  const response = NextResponse.json(result.body, { status: result.status });
  applyCookies(result, { append: (name, value) => response.headers.append(name, value) });
  return response;
}

export async function handleMedia(req: NextRequest) {
  const url = new URL(req.url);
  const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await req.json().catch(() => ({}));
  const session = await identity.handle(toPlatformRequest({
    method: 'GET',
    url: new URL('/session', url.origin),
    headers: headerRecord(req),
    body: {},
  }));
  const payer = session.status === 200 ? (session.body as { address?: string }).address : undefined;
  const router = await mediaRouter();
  const result = await router.handle({
    method: req.method,
    pathname: url.pathname.replace(/^\/api\/media/, '') || '/',
    headers: { ...headerRecord(req), 'x-payment': req.headers.get('x-payment') ?? undefined },
    body,
    payer,
  });
  return NextResponse.json(result.body, { status: result.status });
}

export { SESSION_COOKIE };
