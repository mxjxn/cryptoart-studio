import type { MarketItem } from './domain';

export const commerceLabel = (item: MarketItem) => {
  const { commerce } = item;
  if (commerce.kind === 'auction') {
    return commerce.bidCount
      ? `${commerce.bidCount} bid${commerce.bidCount === 1 ? '' : 's'}`
      : 'Auction';
  }
  if (commerce.kind === 'fixed-price') {
    return commerce.available > 1 ? `${commerce.available} available` : 'Available';
  }
  if (commerce.kind === 'offers') return 'Open to offers';
  return commerce.kind.replace('-', ' ');
};

export function MarketCard({ item, priority = false }: { item: MarketItem; priority?: boolean }) {
  const { artwork, commerce } = item;
  return <article className="min-w-0">
    <a href={commerce.href} className="group block">
      <div className="flex aspect-square items-center overflow-hidden bg-[#111]">
        {artwork.media.previewUrl
          ? <img src={artwork.media.previewUrl} alt={artwork.title} loading={priority ? 'eager' : 'lazy'} className="max-h-full w-full object-contain transition duration-300 group-hover:scale-[1.015] group-hover:opacity-90" />
          : <span className="cryptoart-mono m-auto text-[10px] uppercase tracking-[0.12em] text-neutral-500">Preview resolving</span>}
      </div>
      <div className="border-t border-neutral-300 pt-3">
        <h3 className="truncate text-base font-medium leading-tight">{artwork.title}</h3>
        <div className="cryptoart-mono mt-1 flex justify-between gap-3 text-[10px] uppercase text-neutral-500">
          <span>{commerceLabel(item)}</span>
          <span>{commerce.chainId === 1 ? 'Ethereum' : 'Base'}</span>
        </div>
        <p className="cryptoart-mono mt-2 text-xs font-semibold">{commerce.amount} {commerce.currency}</p>
      </div>
    </a>
  </article>;
}
