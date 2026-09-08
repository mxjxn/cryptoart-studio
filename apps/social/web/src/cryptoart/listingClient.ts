import { listingPath } from '@cryptoart/marketplace';
import { MARKETPLACE_ORIGIN } from './policy';

export type ListingDetail = {
  listingId: string;
  chainId: 1 | 8453;
  marketplace: string;
  seller: string;
  title?: string;
  description?: string;
  image?: string;
  thumbnailUrl?: string;
  initialAmount: string;
  currentPrice?: string;
  erc20?: string;
  erc20TokenInfo?: { symbol?: string; decimals?: number };
  status: string;
  finalized?: boolean;
  hasBid?: boolean;
  bidCount?: number;
  createdAt: string;
  listingType?: 'INDIVIDUAL_AUCTION' | 'FIXED_PRICE' | 'DYNAMIC_PRICE' | 'OFFERS_ONLY';
  highestBid?: { amount: string; bidder: string; timestamp: string };
  tokenAddress?: string;
  tokenId?: string;
  tokenSpec?: 'ERC721' | 'ERC1155';
  totalAvailable?: string | number;
  totalSold?: string | number;
  startTime?: string | number;
  endTime?: string | number;
  minIncrementBPS?: number;
};

export async function fetchListingDetail(chainId: 1 | 8453, listingId: string, signal?: AbortSignal) {
  const url = new URL(`${MARKETPLACE_ORIGIN}/api/auctions/${listingId}`);
  url.searchParams.set('chainId', String(chainId));
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('This listing could not be loaded.');
  const payload = await response.json() as { success?: boolean; auction?: ListingDetail };
  if (!payload.auction) throw new Error('This listing was not found.');
  return payload.auction;
}

export function localListingHref(chainId: 1 | 8453, listingId: string) {
  return listingPath(chainId, listingId);
}
