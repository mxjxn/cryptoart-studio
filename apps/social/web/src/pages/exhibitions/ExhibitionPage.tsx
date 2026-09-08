import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { CryptoartHeader } from '~/cryptoart/CryptoartHeader';
import { localListingHref } from '~/cryptoart/listingClient';

type Exhibition = {
  id: string;
  slug: string;
  title: string;
  description: string;
  curatorAddress: string;
  curatorLabel: string | null;
  items: Array<{
    id: string;
    caption?: string;
    chainId: number;
    listingId?: string;
    title: string;
    artist?: string;
    previewUrl?: string;
  }>;
};

export function ExhibitionPage() {
  const { slug } = useParams();
  const query = useQuery({
    queryKey: ['cryptoart-exhibition', slug],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/cryptoart/exhibitions/${slug}`, { signal, credentials: 'include' });
      const body = await response.json() as { exhibition?: Exhibition; error?: string };
      if (!response.ok || !body.exhibition) throw new Error(body.error || 'Exhibition not found');
      return body.exhibition;
    },
    enabled: Boolean(slug),
    retry: false,
  });
  const exhibition = query.data;
  return <main className="cryptoart-shell min-h-screen bg-[#dcf54c] text-black">
    <CryptoartHeader active="market" />
    <section className="px-4 py-12 sm:px-8 lg:px-12">
      {query.isPending && <p className="cryptoart-mono text-xs uppercase">Loading exhibition…</p>}
      {query.error && <p role="alert" className="border border-black p-4">{query.error.message}</p>}
      {exhibition && <>
        <p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em]">Exhibition · curated by {exhibition.curatorLabel || exhibition.curatorAddress}</p>
        <h1 className="mt-4 text-[clamp(4rem,11vw,9rem)] font-medium leading-[0.72] tracking-[-0.07em]">{exhibition.title}</h1>
        <p className="mt-6 max-w-xl text-lg leading-7">{exhibition.description}</p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {exhibition.items.map((item, index) => {
            const href = item.listingId ? localListingHref(item.chainId === 8453 ? 8453 : 1, item.listingId) : undefined;
            const inner = <>
              <div className="cryptoart-mono flex items-center justify-between border-b border-black px-4 py-3 text-[10px] uppercase"><span>Room {String(index + 1).padStart(2, '0')}</span><span>{item.listingId ? 'Listed' : 'Collected'}</span></div>
              <div className="flex aspect-square items-center bg-black p-3">
                {item.previewUrl ? <img src={item.previewUrl} alt={item.title} className="h-full w-full object-contain" /> : <span className="m-auto text-white">No preview</span>}
              </div>
              <div className="p-4 text-[11px] uppercase"><strong>{item.title}</strong><br />{item.artist}<br />{item.caption}</div>
            </>;
            return <article key={item.id} className="border-2 border-black bg-[#f8f5eb] shadow-[8px_8px_0_#000]">
              {href ? <a href={href} className="block">{inner}</a> : inner}
            </article>;
          })}
        </div>
      </>}
    </section>
  </main>;
}
