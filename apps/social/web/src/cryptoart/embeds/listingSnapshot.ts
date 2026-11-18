import { ListingType, listingPhase, type ListingPhase } from '@cryptoart/marketplace';
import { formatEther } from 'viem';
import type { ListingDetail } from '../listingClient';

export function listingDetailSnapshot(detail: ListingDetail) {
  const listingType = detail.listingType === 'FIXED_PRICE' ? ListingType.FIXED_PRICE
    : detail.listingType === 'DYNAMIC_PRICE' ? ListingType.DYNAMIC_PRICE
    : detail.listingType === 'OFFERS_ONLY' ? ListingType.OFFERS_ONLY
    : ListingType.INDIVIDUAL_AUCTION;
  return {
    listingType,
    seller: detail.seller,
    finalized: Boolean(detail.finalized),
    cancelled: detail.status === 'cancelled',
    startTime: Number(detail.startTime ?? 0),
    endTime: Number(detail.endTime ?? 0),
    totalAvailable: Number(detail.totalAvailable ?? 1),
    totalSold: Number(detail.totalSold ?? 0),
    bidAmount: BigInt(detail.highestBid?.amount ?? '0'),
    bidder: detail.highestBid?.bidder ?? '0x0000000000000000000000000000000000000000',
    initialAmount: BigInt(detail.initialAmount),
    minIncrementBPS: detail.minIncrementBPS ?? 500,
    erc20: detail.erc20 ?? '0x0000000000000000000000000000000000000000',
  };
}

export function listingPhaseLabel(phase: ListingPhase) {
  switch (phase) {
    case 'active': return 'Live';
    case 'scheduled': return 'Scheduled';
    case 'settlement-required': return 'Ended';
    case 'finalized': return 'Finalized';
    case 'sold': return 'Sold';
    case 'cancelled': return 'Cancelled';
    default: return phase;
  }
}

export function formatListingAmount(detail: ListingDetail, wei?: bigint) {
  const native = !detail.erc20 || detail.erc20 === '0x0000000000000000000000000000000000000000';
  const amount = wei ?? BigInt(detail.currentPrice ?? detail.highestBid?.amount ?? detail.initialAmount ?? '0');
  if (native) return `${formatEther(amount)} ETH`;
  return `${amount.toString()} ${detail.erc20TokenInfo?.symbol ?? 'ERC20'}`;
}

export function listingPriceLine(detail: ListingDetail, phase: ListingPhase) {
  if (detail.listingType === 'OFFERS_ONLY') return 'Offers only';
  if (detail.listingType === 'INDIVIDUAL_AUCTION') {
    const bid = detail.highestBid?.amount;
    if (bid && bid !== '0') return `Current bid · ${formatListingAmount(detail, BigInt(bid))}`;
    return `Reserve · ${formatListingAmount(detail)}`;
  }
  if (detail.listingType === 'DYNAMIC_PRICE') {
    return `Dynamic · ${formatListingAmount(detail)}`;
  }
  if (phase === 'sold' || phase === 'finalized') return `Collected · ${formatListingAmount(detail)}`;
  return `Buy now · ${formatListingAmount(detail)}`;
}

/** Reserved hook for audio / 3D / generative media players (PR 208). */
export function listingEmbedMediaKind(_detail: ListingDetail): 'image' {
  return 'image';
}