import type { MarketplaceListingData } from './marketplace';

const typeLabel = (listing: MarketplaceListingData) => {
  if (listing.listingType === 'INDIVIDUAL_AUCTION') return listing.bidCount ? `${listing.bidCount} bid${listing.bidCount === 1 ? '' : 's'}` : 'Auction';
  if (listing.listingType === 'FIXED_PRICE') return listing.available > 1 ? `${listing.available} available` : 'Available now';
  if (listing.listingType === 'OFFERS_ONLY') return 'Open to offers';
  return 'Dynamic price';
};

export function MarketplaceGrid({ listings }: { listings: MarketplaceListingData[] }) {
  if (!listings.length) return null;
  return <section aria-labelledby="latest-listings" className="pb-16">
    <header className="flex items-end justify-between gap-5 px-4 pb-6 pt-14 sm:px-8 sm:pt-20">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">Marketplace · newest first</p>
        <h2 id="latest-listings" className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">Latest listings</h2>
      </div>
      <a href="https://cryptoart.social/market" className="shrink-0 text-xs uppercase tracking-[0.12em] underline">View market</a>
    </header>
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 px-4 sm:grid-cols-3 sm:gap-x-4 sm:px-8">
      {listings.map(listing => <article key={`${listing.chainId}:${listing.listingId}`} className="min-w-0">
        <a href={listing.href} className="group block">
          <div className="flex aspect-square items-center bg-black">
            {listing.imageUrl
              ? <img src={listing.imageUrl} alt={listing.title} className="max-h-full w-full object-contain transition-opacity group-hover:opacity-90" />
              : <div className="m-auto text-xs uppercase tracking-widest text-gray-500">Preview pending</div>}
          </div>
          <h3 className="mt-3 truncate font-serif text-base leading-tight">{listing.title}</h3>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted">
            <span>{typeLabel(listing)}</span><span>{listing.chainId === 1 ? 'ETH' : 'BASE'}</span>
          </div>
          <p className="mt-1 text-xs font-semibold">{listing.amount} {listing.currency}</p>
        </a>
      </article>)}
    </div>
  </section>;
}
