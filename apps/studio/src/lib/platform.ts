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
  createUnavailableArweave,
  resolveAllowMockPayment,
} from '@cryptoart/media';

const postgresUrl = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;
const isProd = process.env.NODE_ENV === 'production';

const identity = createIdentityRouter({
  store: postgresUrl ? createPostgresIdentityStore(postgresUrl) : createMemoryIdentityStore(),
  ownerAddress: process.env.CRYPTOART_OWNER_ADDRESS,
  secureCookies: isProd,
});

let mediaPromise: ReturnType<typeof createMediaRouter> | Promise<ReturnType<typeof createMediaRouter>> | null = null;

async function mediaRouter() {
  if (mediaPromise) return mediaPromise;
  mediaPromise = (async () => {
    const allowMockPayment = resolveAllowMockPayment({
      CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT: process.env.CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT,
      NODE_ENV: process.env.NODE_ENV,
    });

    const arweave = process.env.TURBO_PRIVATE_KEY
      ? await createTurboArweave(process.env.TURBO_PRIVATE_KEY)
      : isProd
        ? createUnavailableArweave('TURBO_PRIVATE_KEY is required in production for Arweave uploads')
        : createSimulatedArweave();

    const facilitator = process.env.X402_FACILITATOR_URL
      ? await createHttpFacilitator(process.env.X402_FACILITATOR_URL, {
          token: process.env.X402_FACILITATOR_TOKEN,
        })
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
      usdcName: process.env.CRYPTOART_MEDIA_USDC_NAME,
      usdcVersion: process.env.CRYPTOART_MEDIA_USDC_VERSION,
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
