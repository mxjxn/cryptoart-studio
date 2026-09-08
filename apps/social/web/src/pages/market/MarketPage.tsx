import { useQuery } from '@tanstack/react-query';
import { CryptoartHeader } from '~/cryptoart/CryptoartHeader';
import { editorialExhibition } from '~/cryptoart/exhibitionFixture';
import { MarketCard } from '~/cryptoart/MarketCard';
import { fetchMarketPage } from '~/cryptoart/marketClient';
import { YourItems } from '~/cryptoart/YourItems';
import { localListingHref } from '~/cryptoart/listingClient';
import type { Exhibition } from '~/cryptoart/domain';

function fromApi(record: {
  slug: string;
  title: string;
  description: string;
  curatorLabel?: string | null;
  curatorAddress: string;
  items: Array<{
    id: string;
    position: number;
    caption?: string;
    chainId: number;
    contractAddress: string;
    tokenId: string;
    listingId?: string;
    title: string;
    artist?: string;
    previewUrl?: string;
    canonicalUrl?: string;
  }>;
}): Exhibition {
  return {
    id: record.slug,
    slug: record.slug,
    title: record.title,
    description: record.description,
    curator: record.curatorLabel || record.curatorAddress,
    source: 'such-gallery',
    publication: 'editorial',
    placements: record.items.map((item) => ({
      id: item.id,
      position: item.position,
      caption: item.caption,
      artwork: {
        id: {
          chainId: item.chainId === 8453 ? 8453 : 1,
          contractAddress: item.contractAddress,
          tokenId: item.tokenId,
        },
        title: item.title,
        artist: item.artist,
        media: { canonicalUrl: item.canonicalUrl, previewUrl: item.previewUrl },
      },
      commerce: item.listingId ? {
        kind: 'auction',
        chainId: item.chainId === 8453 ? 8453 : 1,
        id: item.listingId,
        href: localListingHref(item.chainId === 8453 ? 8453 : 1, item.listingId),
        amount: '',
        currency: 'ETH',
        available: 1,
        bidCount: 0,
        status: 'active',
      } : undefined,
    })),
  };
}

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
  const published = useQuery({
    queryKey: ['cryptoart-market-exhibition'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/cryptoart/exhibitions/slot/market-current', { signal });
      const body = await response.json() as { exhibition?: Parameters<typeof fromApi>[0] | null };
      return body.exhibition ? fromApi(body.exhibition) : editorialExhibition;
    },
    staleTime: 30_000,
    retry: false,
  });
  const exhibition = published.data ?? editorialExhibition;
  return <main className="cryptoart-shell min-h-screen overflow-hidden bg-black text-white">
    <CryptoartHeader active="market" />
    <section id="exhibitions" aria-labelledby="current-exhibition" className="bg-[#dcf54c] px-4 py-12 text-black sm:px-8 md:py-20 lg:px-12">
      <div>
        <header className="grid gap-6 border-b border-black pb-10 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
          <p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em]">Current exhibition · curated by {exhibition.curator}</p>
          <h1 id="current-exhibition" className="mt-4 text-[clamp(4rem,11vw,9rem)] font-medium leading-[0.72] tracking-[-0.07em]">{exhibition.title}</h1>
          </div>
          <div className="lg:pb-2"><p className="max-w-md text-lg leading-7">{exhibition.description}</p><p className="cryptoart-mono mt-6 text-[10px] uppercase tracking-[0.12em]">such.gallery editorial presentation · native 2D preview</p></div>
        </header>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:gap-8">
          {exhibition.placements.map((placement, index) => <article key={placement.id} className="border-2 border-black bg-[#f8f5eb] shadow-[8px_8px_0_#000]">
            <a href={placement.commerce?.href ?? '#'} className="group flex h-full flex-col">
              <div className="cryptoart-mono flex items-center justify-between border-b border-black px-4 py-3 text-[10px] uppercase tracking-[0.1em]"><span>Artist room {String(index + 1).padStart(2, '0')}</span><span>{placement.commerce ? 'Available' : 'Collected'}</span></div>
              <div className="flex aspect-square items-center bg-black p-3 sm:p-5">
                <img src={placement.artwork.media.previewUrl} alt={placement.artwork.title} className="h-full w-full object-contain transition duration-500 group-hover:scale-[0.985]" />
              </div>
              <div className="cryptoart-mono grid flex-1 grid-cols-[1fr_auto] gap-4 p-4 text-[11px] uppercase tracking-[0.08em]">
                <p><strong>{placement.artwork.title}</strong><br />{placement.artwork.artist}</p>
                <p className="text-right">{placement.caption}<br />{placement.commerce ? `${placement.commerce.amount} ${placement.commerce.currency}` : 'Not currently listed'}</p>
              </div>
            </a>
          </article>)}
        </div>
      </div>
    </section>

    <YourItems />

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
