import type { MarketplaceListingData } from './marketplace';

const typeLabel = (listing: MarketplaceListingData) => {
  if (listing.listingType === 'INDIVIDUAL_AUCTION') return listing.bidCount ? `${listing.bidCount} bid${listing.bidCount === 1 ? '' : 's'}` : 'Auction';
  if (listing.listingType === 'FIXED_PRICE') return listing.available > 1 ? `${listing.available} available` : 'Available now';
  if (listing.listingType === 'OFFERS_ONLY') return 'Open to offers';
  return 'Dynamic price';
};

export function MarketplaceGrid({ listings }: { listings: MarketplaceListingData[] }) {
  if (!listings.length) return null;
  return <section aria-labelledby="latest-listings" className="bg-white pb-16 text-black">
    <header className="flex items-end justify-between gap-5 px-4 pb-6 pt-14 sm:px-8 sm:pt-20">
      <div>
        <p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">Marketplace · newest first</p>
        <h2 id="latest-listings" className="mt-1 text-[clamp(2.6rem,8vw,5.5rem)] font-medium leading-[0.88] tracking-[-0.04em] text-black">Latest listings</h2>
      </div>
      <a href="https://cryptoart.social/market" className="cryptoart-mono shrink-0 text-xs uppercase tracking-[0.1em] text-black underline">View market</a>
    </header>
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 px-4 sm:grid-cols-3 sm:gap-x-4 sm:px-8">
      {listings.map(listing => <article key={`${listing.chainId}:${listing.listingId}`} className="min-w-0">
        <a href={listing.href} className="group block">
          <div className="flex aspect-square items-center bg-black">
            {listing.imageUrl
              ? <img src={listing.imageUrl} alt={listing.title} className="max-h-full w-full object-contain transition-opacity group-hover:opacity-90" />
              : <div className="m-auto text-xs uppercase tracking-widest text-gray-500">Preview pending</div>}
          </div>
          <h3 className="mt-3 truncate text-base font-medium leading-tight text-black">{listing.title}</h3>
          <div className="cryptoart-mono mt-1 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
            <span>{typeLabel(listing)}</span><span>{listing.chainId === 1 ? 'ETH' : 'BASE'}</span>
          </div>
          <p className="cryptoart-mono mt-1 text-xs font-semibold text-black">{listing.amount} {listing.currency}</p>
        </a>
      </article>)}
    </div>
  </section>;
}
