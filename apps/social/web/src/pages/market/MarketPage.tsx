import { useQuery } from '@tanstack/react-query';
import { CryptoartHeader } from '~/cryptoart/CryptoartHeader';
import { editorialExhibition } from '~/cryptoart/exhibitionFixture';
import { MarketCard } from '~/cryptoart/MarketCard';
import { fetchMarketPage } from '~/cryptoart/marketClient';

export function MarketPage() {
  const market = useQuery({
    queryKey: ['cryptoart-market-preview'],
    queryFn: ({ signal }) => fetch('/api/cryptoart/market?first=8', { signal }).then(async response => {
      if (!response.ok) throw new Error('The marketplace could not be loaded.');
      return await response.json() as Awaited<ReturnType<typeof fetchMarketPage>>;
    }),
    staleTime: 60_000,
    retry: false,
  });
  const exhibition = editorialExhibition;
  return <main className="cryptoart-shell min-h-screen overflow-hidden bg-black text-white">
    <CryptoartHeader active="market" />
    <section id="exhibitions" aria-labelledby="current-exhibition" className="bg-[#dcf54c] px-4 py-12 text-black sm:px-8 md:py-20 lg:px-12">
      <div className="grid gap-8 lg:grid-cols-[0.68fr_1.32fr]">
        <header className="lg:sticky lg:top-8 lg:self-start">
          <p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em]">Current exhibition · curated by {exhibition.curator}</p>
          <h1 id="current-exhibition" className="mt-4 text-[clamp(4rem,11vw,9rem)] font-medium leading-[0.72] tracking-[-0.07em]">{exhibition.title}</h1>
          <p className="mt-8 max-w-md text-lg leading-7">{exhibition.description}</p>
          <p className="cryptoart-mono mt-8 text-[10px] uppercase tracking-[0.12em]">such.gallery editorial presentation · native 2D preview</p>
        </header>
        <div className="space-y-16">
          {exhibition.placements.map((placement, index) => <article key={placement.id} className={index % 2 ? 'ml-auto max-w-[78%]' : 'max-w-[90%]'}>
            <a href={placement.commerce?.href ?? '#'} className="group block">
              <div className="flex min-h-[260px] items-center bg-black p-3 sm:min-h-[420px]">
                <img src={placement.artwork.media.previewUrl} alt={placement.artwork.title} className="max-h-[680px] w-full object-contain" />
              </div>
              <div className="cryptoart-mono mt-3 grid grid-cols-[1fr_auto] gap-4 text-[11px] uppercase tracking-[0.08em]">
                <p><strong>{placement.artwork.title}</strong><br />{placement.artwork.artist}</p>
                <p className="text-right">{placement.caption}<br />{placement.commerce ? `${placement.commerce.amount} ${placement.commerce.currency}` : 'Not currently listed'}</p>
              </div>
            </a>
          </article>)}
        </div>
      </div>
    </section>

    <section aria-labelledby="your-items" className="grid border-b border-white bg-[#f5b0d3] text-black md:grid-cols-2">
      <div className="border-b border-black p-8 md:border-b-0 md:border-r lg:p-12">
        <p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em]">Personal collection</p>
        <h2 id="your-items" className="mt-2 text-[clamp(3rem,8vw,6rem)] font-medium leading-[0.82] tracking-[-0.05em]">Your items</h2>
      </div>
      <div className="flex flex-col justify-between gap-8 p-8 lg:p-12">
        <p className="max-w-xl text-lg leading-7">Connect your wallet to share work, start a conversation, create a listing, or place an item in one of your galleries.</p>
        <a href="/~/sign-in-with-farcaster" className="cryptoart-mono w-fit border border-black bg-black px-6 py-3 text-xs uppercase tracking-[0.1em] text-white">Connect identity →</a>
      </div>
    </section>

    <section aria-labelledby="market-selections" className="bg-white px-4 py-14 text-black sm:px-8 lg:px-12 lg:py-20">
      <header className="mb-10 flex items-end justify-between gap-5">
        <div><p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">Live auctionhouse read</p><h2 id="market-selections" className="mt-1 text-[clamp(3rem,9vw,7rem)] font-medium leading-[0.8] tracking-[-0.06em]">Marketplace selections</h2></div>
        <a href="/market/all" className="cryptoart-mono shrink-0 text-xs uppercase underline">View all</a>
      </header>
      {market.isPending && <p role="status" className="cryptoart-mono py-16 text-center text-xs uppercase">Resolving current listings…</p>}
      {market.error && <p role="alert" className="border border-black p-6">{market.error.message}</p>}
      {market.data?.degraded && <p className="cryptoart-mono mb-5 text-[10px] uppercase">Showing cached marketplace data while an index source recovers.</p>}
      <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
        {market.data?.items.map((item, index) => <MarketCard key={`${item.commerce.chainId}:${item.commerce.id}`} item={item} priority={index < 4} />)}
      </div>
    </section>
  </main>;
}
