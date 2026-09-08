import type {
  CommerceKind,
  MarketItem,
  MarketPageResult,
  SupportedChainId,
  TokenStandard,
} from './domain';
import { MARKETPLACE_ORIGIN } from './policy';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

type SourceListing = {
  listingId: string;
  chainId: number;
  marketplace: string;
  seller: string;
  tokenAddress?: string;
  tokenId?: string;
  tokenSpec?: TokenStandard;
  listingType?: 'INDIVIDUAL_AUCTION' | 'FIXED_PRICE' | 'DYNAMIC_PRICE' | 'OFFERS_ONLY';
  title?: string;
  artist?: string;
  description?: string;
  image?: string;
  thumbnailUrl?: string;
  detailThumbnailUrl?: string;
  initialAmount: string;
  currentPrice?: string;
  erc20?: string;
  erc20TokenInfo?: { symbol?: string; decimals?: number };
  totalAvailable?: string | number;
  totalSold?: string | number;
  bidCount?: number;
  createdAt: string;
  status: string;
  finalized?: boolean;
  highestBid?: { amount: string };
};

type BrowsePayload = {
  success: boolean;
  listings?: SourceListing[];
  degraded?: boolean;
  subgraphDown?: boolean;
  pagination?: MarketPageResult['pagination'];
};

type DetailPayload = { success: boolean; auction?: SourceListing };

const chainId = (value: number): SupportedChainId | null =>
  value === 1 || value === 8453 ? value : null;

const kind = (value: SourceListing['listingType']): CommerceKind | null => {
  if (value === 'INDIVIDUAL_AUCTION') return 'auction';
  if (value === 'FIXED_PRICE') return 'fixed-price';
  if (value === 'DYNAMIC_PRICE') return 'dynamic-price';
  if (value === 'OFFERS_ONLY') return 'offers';
  return null;
};

const listingHref = (chain: SupportedChainId, id: string) =>
  `${MARKETPLACE_ORIGIN}/listing/${chain === 1 ? 'eth/' : ''}${id}`;

export function formatTokenAmount(raw: string, decimals: number) {
  const value = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base)
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '')
    .slice(0, 6);
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function normalizeMarketItem(row: SourceListing): MarketItem | null {
  const supportedChain = chainId(row.chainId);
  const commerceKind = kind(row.listingType);
  if (!supportedChain || !commerceKind) return null;
  const native = !row.erc20 || row.erc20.toLowerCase() === ZERO_ADDRESS;
  const decimals = native ? 18 : row.erc20TokenInfo?.decimals;
  const currency = native ? 'ETH' : row.erc20TokenInfo?.symbol;
  if (decimals === undefined || !currency) return null;
  const available = Math.max(
    0,
    Number(row.totalAvailable ?? 1) - Number(row.totalSold ?? 0),
  );
  const status = row.status === 'CANCELLED'
    ? 'cancelled'
    : row.status === 'ACTIVE' && !row.finalized && available > 0
      ? 'active'
      : 'finished';
  return {
    artwork: {
      id: {
        chainId: supportedChain,
        contractAddress: row.tokenAddress ?? '',
        tokenId: row.tokenId ?? '',
      },
      title: row.title || `Listing #${row.listingId}`,
      description: row.description,
      artist: row.artist,
      media: {
        canonicalUrl: row.image,
        previewUrl: row.thumbnailUrl || row.detailThumbnailUrl || row.image,
      },
    },
    commerce: {
      kind: commerceKind,
      chainId: supportedChain,
      id: String(row.listingId),
      href: listingHref(supportedChain, String(row.listingId)),
      amount: formatTokenAmount(
        row.highestBid?.amount ?? row.currentPrice ?? row.initialAmount,
        decimals,
      ),
      currency,
      available,
      bidCount: row.bidCount ?? 0,
      status,
    },
    createdAt: Number(row.createdAt) * 1000,
  };
}

async function hydrate(row: SourceListing, request: typeof fetch, signal?: AbortSignal) {
  if (row.title && (row.thumbnailUrl || row.image)) return row;
  const supportedChain = chainId(row.chainId);
  if (!supportedChain) return row;
  const url = new URL(`${MARKETPLACE_ORIGIN}/api/auctions/${row.listingId}`);
  url.searchParams.set('chainId', String(supportedChain));
  try {
    const response = await request(url, { signal });
    if (!response.ok) return row;
    return ((await response.json()) as DetailPayload).auction ?? row;
  } catch {
    return row;
  }
}

export async function fetchMarketPage(
  options: { first?: number; skip?: number; signal?: AbortSignal } = {},
  request: typeof fetch = fetch,
): Promise<MarketPageResult> {
  const first = options.first ?? 24;
  const skip = options.skip ?? 0;
  const url = new URL(`${MARKETPLACE_ORIGIN}/api/listings/browse`);
  Object.entries({
    first: String(first),
    skip: String(skip),
    orderBy: 'createdAt',
    orderDirection: 'desc',
    enrich: 'true',
    marketMode: 'live',
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await request(url, { signal: options.signal });
  if (!response.ok) throw new Error(`Marketplace returned ${response.status}`);
  const payload = (await response.json()) as BrowsePayload;
  if (!payload.success) throw new Error('Marketplace returned an invalid response');
  const hydrated = await Promise.all(
    (payload.listings ?? []).map(row => hydrate(row, request, options.signal)),
  );
  const items = hydrated
    .map(normalizeMarketItem)
    .filter((item): item is MarketItem => item?.commerce.status === 'active');
  return {
    items,
    pagination: payload.pagination ?? {
      first,
      skip,
      hasMore: (payload.listings?.length ?? 0) === first,
    },
    degraded: Boolean(payload.degraded || payload.subgraphDown),
  };
}
