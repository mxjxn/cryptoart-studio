import { canBid, canBuy, listingPhase } from '@cryptoart/marketplace';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { listingHrefWithReferral } from '../listing-links';
import { fetchListingDetail, localListingHref, type ListingDetail } from '../listingClient';
import { listingDetailSnapshot, listingEmbedMediaKind, listingPhaseLabel, listingPriceLine } from './listingSnapshot';

function ListingEmbedSkeleton() {
  return <div className="animate-pulse overflow-hidden rounded-md border border-[#2a2a2a] bg-[#111]" aria-hidden="true">
    <div className="h-36 bg-[#1a1a1a]" />
    <div className="space-y-2 px-2.5 py-2">
      <div className="h-3 w-2/3 rounded bg-[#222]" />
      <div className="h-2 w-1/2 rounded bg-[#1c1c1c]" />
    </div>
  </div>;
}

function ListingEmbedBody({ detail, originalUrl }: { detail: ListingDetail; originalUrl?: string }) {
  const snapshot = listingDetailSnapshot(detail);
  const phase = snapshot.cancelled ? 'cancelled' : listingPhase(snapshot);
  const path = localListingHref(detail.chainId, detail.listingId);
  const viewHref = listingHrefWithReferral(path, originalUrl);
  const bidHref = listingHrefWithReferral(path, originalUrl, canBid(snapshot) ? { action: 'bid' } : undefined);
  const buyHref = listingHrefWithReferral(path, originalUrl, canBuy(snapshot) ? { action: 'buy' } : undefined);
  const mediaKind = listingEmbedMediaKind(detail);
  const mediaUrl = detail.thumbnailUrl || detail.image;
  const endsAt = Number(detail.endTime ?? 0);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!endsAt || phase !== 'active') return;
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => window.clearInterval(timer);
  }, [endsAt, phase]);
  const countdown = endsAt > now && phase === 'active'
    ? `${Math.max(0, endsAt - now)}s left`
  : undefined;

  return <article className="overflow-hidden rounded-md border border-[#2a2a2a] bg-[#111]">
    <a href={viewHref} className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 border-b border-[#222] p-2 hover:bg-[#151515]">
      <div className="flex aspect-square items-center justify-center bg-[#0a0a0a]">
        {mediaUrl
          ? <img src={mediaUrl} alt={detail.title ?? `Listing ${detail.listingId}`} className="max-h-full max-w-full object-contain" data-media-kind={mediaKind} />
          : <span className="cryptoart-mono px-1 text-center text-[9px] uppercase text-[#555]">Preview</span>}
      </div>
      <div className="min-w-0 py-0.5">
        <p className="cryptoart-mono text-[10px] uppercase tracking-[0.08em] text-[#666]">
          {detail.chainId === 1 ? 'Ethereum' : 'Base'} · {listingPhaseLabel(phase)}
          {countdown ? ` · ${countdown}` : ''}
        </p>
        <h3 className="mt-1 truncate text-[14px] font-medium text-[#f0f0f0]">{detail.title ?? `Listing #${detail.listingId}`}</h3>
        <p className="mt-1 text-[12px] text-[#aaa]">{listingPriceLine(detail, phase)}</p>
      </div>
    </a>
    <div className="flex flex-wrap gap-2 px-2 py-2">
      <a href={viewHref} className="cryptoart-mono border border-[#333] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[#ddd] hover:border-[#dcf54c] hover:text-[#dcf54c]">View</a>
      {canBid(snapshot) && <a href={bidHref} className="cryptoart-mono border border-[#dcf54c] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[#dcf54c] hover:bg-[#dcf54c] hover:text-black">Bid</a>}
      {canBuy(snapshot) && <a href={buyHref} className="cryptoart-mono border border-white px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-white hover:bg-white hover:text-black">Buy</a>}
      {detail.listingType === 'OFFERS_ONLY' && <span className="cryptoart-mono text-[10px] uppercase tracking-[0.08em] text-[#666]">Make offer (coming soon)</span>}
    </div>
  </article>;
}

export function ListingEmbedCard({ chainId, listingId, originalUrl }: { chainId: 1 | 8453; listingId: string; originalUrl?: string }) {
  const listing = useQuery({
    queryKey: ['cryptoart-desk-listing-embed', chainId, listingId],
    queryFn: ({ signal }) => fetchListingDetail(chainId, listingId, signal),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  if (listing.isPending) return <ListingEmbedSkeleton />;
  if (listing.error || !listing.data) {
    return <div className="rounded-md border border-[#3a2020] bg-[#140a0a] px-2.5 py-2 text-[12px] text-[#c88]">Listing {listingId} could not be loaded.</div>;
  }
  return <ListingEmbedBody detail={listing.data} originalUrl={originalUrl} />;
}