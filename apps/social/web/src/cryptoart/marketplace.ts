import { MARKETPLACE_ORIGIN } from './policy';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface AuctionPerson {
  address: string;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

export interface AuctionCardData {
  kind: 'featured-auction' | 'recent-sale';
  chainId: 1 | 8453;
  listingId: string;
  marketplace: string;
  title: string;
  description?: string;
  imageUrl?: string;
  href: string;
  seller: AuctionPerson;
  buyer?: AuctionPerson;
  amount: string;
  currency: string;
  bidCount: number;
  timestamp: number;
}

export interface MarketplaceListingData {
  chainId: 1 | 8453;
  listingId: string;
  listingType: 'INDIVIDUAL_AUCTION' | 'FIXED_PRICE' | 'DYNAMIC_PRICE' | 'OFFERS_ONLY';
  title: string;
  imageUrl?: string;
  href: string;
  amount: string;
  currency: string;
  available: number;
  bidCount: number;
  createdAt: number;
}

interface AuctionResponse {
  success: boolean;
  auction?: {
    listingId: string;
    chainId: number;
    marketplace: string;
    seller: string;
    title?: string;
    description?: string;
    image?: string;
    thumbnailUrl?: string;
    initialAmount: string;
    erc20?: string;
    erc20TokenInfo?: { symbol?: string; decimals?: number };
    status: string;
    finalized?: boolean;
    hasBid?: boolean;
    bidCount?: number;
    createdAt: string;
    updatedAt?: string;
    highestBid?: { amount: string; bidder: string; timestamp: string };
    listingType?: MarketplaceListingData['listingType'];
    currentPrice?: string;
    totalAvailable?: string | number;
    totalSold?: string | number;
  };
}

interface BrowseResponse {
  success: boolean;
  listings?: Array<NonNullable<AuctionResponse['auction']>>;
}

interface HandlesResponse {
  success: boolean;
  handles?: { username?: string; displayName?: string; pfpUrl?: string }[];
}

function canonicalHref(chainId: number, listingId: string) {
  return `/listing/${chainId === 1 ? 'eth/' : 'base/'}${listingId}`;
}

function amountLabel(raw: string, decimals: number) {
  const value = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 6);
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

async function person(address: string, request: typeof fetch): Promise<AuctionPerson> {
  try {
    const response = await request(`${MARKETPLACE_ORIGIN}/api/farcaster-handles/${address}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { address };
    const handle = ((await response.json()) as HandlesResponse).handles?.[0];
    return { address, ...handle };
  } catch {
    return { address };
  }
}

export async function fetchAuctionCard(
  ref: { chainId: 1 | 8453; listingId: string },
  kind: AuctionCardData['kind'],
  request: typeof fetch = fetch,
): Promise<AuctionCardData> {
  const url = new URL(`${MARKETPLACE_ORIGIN}/api/auctions/${ref.listingId}`);
  url.searchParams.set('chainId', String(ref.chainId));
  const response = await request(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Listing ${ref.chainId}:${ref.listingId} returned ${response.status}`);
  const auction = ((await response.json()) as AuctionResponse).auction;
  if (!auction || auction.chainId !== ref.chainId || String(auction.listingId) !== ref.listingId) {
    throw new Error(`Listing ${ref.chainId}:${ref.listingId} did not match its response`);
  }
  if (kind === 'featured-auction' && auction.status !== 'ACTIVE') {
    throw new Error(`Featured listing ${ref.chainId}:${ref.listingId} is not active`);
  }
  if (kind === 'recent-sale' && !(auction.finalized && auction.hasBid && auction.highestBid)) {
    throw new Error(`Sale ${ref.chainId}:${ref.listingId} is not a finalized auction with a winning bid`);
  }
  const native = !auction.erc20 || auction.erc20.toLowerCase() === ZERO_ADDRESS;
  const decimals = native ? 18 : auction.erc20TokenInfo?.decimals;
  const currency = native ? 'ETH' : auction.erc20TokenInfo?.symbol;
  if (decimals === undefined || !currency) throw new Error(`Payment token for ${ref.chainId}:${ref.listingId} is unresolved`);
  const sellerPromise = person(auction.seller, request);
  const buyerPromise = auction.highestBid ? person(auction.highestBid.bidder, request) : undefined;
  return {
    kind,
    chainId: ref.chainId,
    listingId: ref.listingId,
    marketplace: auction.marketplace,
    title: auction.title || `Listing #${ref.listingId}`,
    description: auction.description,
    imageUrl: auction.thumbnailUrl || auction.image,
    href: canonicalHref(ref.chainId, ref.listingId),
    seller: await sellerPromise,
    buyer: buyerPromise ? await buyerPromise : undefined,
    amount: amountLabel(auction.highestBid?.amount ?? auction.initialAmount, decimals),
    currency,
    bidCount: auction.bidCount ?? 0,
    timestamp: Number(auction.highestBid?.timestamp ?? auction.updatedAt ?? auction.createdAt) * 1000,
  };
}

/** Use the marketplace's graph-backed browse order, then hydrate canonical artwork metadata. */
export async function fetchLatestListings(request: typeof fetch = fetch, limit = 8): Promise<MarketplaceListingData[]> {
  const browseUrl = new URL(`${MARKETPLACE_ORIGIN}/api/listings/browse`);
  Object.entries({ first: String(Math.max(limit + 4, 12)), skip: '0', orderBy: 'createdAt', orderDirection: 'desc',
    enrich: 'false', marketMode: 'live' }).forEach(([key, value]) => browseUrl.searchParams.set(key, value));
  const browseResponse = await request(browseUrl, { signal: AbortSignal.timeout(20000) });
  if (!browseResponse.ok) throw new Error(`Latest listings returned ${browseResponse.status}`);
  const rows = ((await browseResponse.json()) as BrowseResponse).listings ?? [];
  const live = rows.filter(row => row.status === 'ACTIVE' && !row.finalized &&
    Number(row.totalSold ?? 0) < Number(row.totalAvailable ?? 1));

  const hydrated = await Promise.all(live.map(async row => {
    const chainId = row.chainId === 1 ? 1 : row.chainId === 8453 ? 8453 : null;
    if (!chainId) return null;
    const detailUrl = new URL(`${MARKETPLACE_ORIGIN}/api/auctions/${row.listingId}`);
    detailUrl.searchParams.set('chainId', String(chainId));
    try {
      const detailResponse = await request(detailUrl, { signal: AbortSignal.timeout(20000) });
      if (!detailResponse.ok) return row;
      return ((await detailResponse.json()) as AuctionResponse).auction ?? row;
    } catch { return row; }
  }));

  return hydrated.flatMap(auction => {
    if (!auction || !auction.listingType) return [];
    const chainId = auction.chainId as 1 | 8453;
    const native = !auction.erc20 || auction.erc20.toLowerCase() === ZERO_ADDRESS;
    const decimals = native ? 18 : auction.erc20TokenInfo?.decimals;
    const currency = native ? 'ETH' : auction.erc20TokenInfo?.symbol;
    if (decimals === undefined || !currency) return [];
    const available = Math.max(0, Number(auction.totalAvailable ?? 1) - Number(auction.totalSold ?? 0));
    if (!available) return [];
    return [{ chainId, listingId: String(auction.listingId), listingType: auction.listingType,
      title: auction.title || `Listing #${auction.listingId}`, imageUrl: auction.thumbnailUrl || auction.image,
      href: canonicalHref(chainId, String(auction.listingId)),
      amount: amountLabel(auction.highestBid?.amount ?? auction.currentPrice ?? auction.initialAmount, decimals),
      currency, available, bidCount: auction.bidCount ?? 0, createdAt: Number(auction.createdAt) * 1000 }];
  }).slice(0, limit);
}

export function personLabel(value: AuctionPerson) {
  return value.username ? `@${value.username}` : `${value.address.slice(0, 6)}…${value.address.slice(-4)}`;
}
