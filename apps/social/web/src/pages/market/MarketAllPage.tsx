import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CryptoartHeader } from '~/cryptoart/CryptoartHeader';
import type { CommerceKind, SupportedChainId } from '~/cryptoart/domain';
import { MarketCard } from '~/cryptoart/MarketCard';
import { fetchMarketPage } from '~/cryptoart/marketClient';

const PAGE_SIZE = 24;
type TypeFilter = 'all' | Extract<CommerceKind, 'auction' | 'fixed-price' | 'dynamic-price' | 'offers'>;

export function MarketAllPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const chain = params.get('chain') === '1' ? 1 : params.get('chain') === '8453' ? 8453 : 'all';
  const requestedType = params.get('type');
  const type: TypeFilter = ['auction', 'fixed-price', 'dynamic-price', 'offers'].includes(requestedType ?? '') ? requestedType as TypeFilter : 'all';
  const sort = params.get('sort') === 'price-asc' ? 'price-asc' : 'newest';
  const market = useQuery({
    queryKey: ['cryptoart-market-all', page],
    queryFn: ({ signal }) => fetch(`/api/cryptoart/market?first=${PAGE_SIZE}&skip=${(page - 1) * PAGE_SIZE}`, { signal }).then(async response => {
      if (!response.ok) throw new Error('The marketplace could not be loaded.');
      return await response.json() as Awaited<ReturnType<typeof fetchMarketPage>>;
    }),
    staleTime: 60_000,
    retry: false,
  });
  const items = useMemo(() => {
    const filtered = (market.data?.items ?? []).filter(item =>
      (chain === 'all' || item.commerce.chainId === chain) &&
      (type === 'all' || item.commerce.kind === type));
    if (sort === 'price-asc') return [...filtered].sort((a, b) => Number(a.commerce.amount) - Number(b.commerce.amount));
    return filtered;
  }, [chain, market.data?.items, sort, type]);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === 'all' || (key === 'sort' && value === 'newest')) next.delete(key); else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };
  return <main className="cryptoart-shell min-h-screen overflow-hidden bg-white text-black">
    <div className="bg-black text-white"><CryptoartHeader active="market" /></div>
    <header className="border-b border-black px-4 py-12 sm:px-8 lg:px-12 lg:py-20">
      <p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">Complete inventory</p>
      <h1 className="mt-2 text-[clamp(4rem,13vw,11rem)] font-medium leading-[0.72] tracking-[-0.07em]">All works</h1>
    </header>
    <div className="cryptoart-mono grid border-b border-black text-[11px] uppercase sm:grid-cols-3">
      <label className="border-b border-black p-4 sm:border-b-0 sm:border-r">Chain <select value={chain} onChange={event => update('chain', event.target.value)} className="ml-3 bg-transparent font-bold"><option value="all">All</option><option value="1">Ethereum</option><option value="8453">Base</option></select></label>
      <label className="border-b border-black p-4 sm:border-b-0 sm:border-r">Type <select value={type} onChange={event => update('type', event.target.value)} className="ml-3 bg-transparent font-bold"><option value="all">All</option><option value="auction">Auctions</option><option value="fixed-price">Fixed price</option><option value="dynamic-price">Dynamic price</option><option value="offers">Offers</option></select></label>
      <label className="p-4">Order <select value={sort} onChange={event => update('sort', event.target.value)} className="ml-3 bg-transparent font-bold"><option value="newest">Newest</option><option value="price-asc">Price, low first</option></select></label>
    </div>
    <section aria-label="Marketplace inventory" className="px-4 py-12 sm:px-8 lg:px-12">
      {market.isPending && <p role="status" className="cryptoart-mono py-20 text-center text-xs uppercase">Resolving marketplace inventory…</p>}
      {market.error && <p role="alert" className="border border-black p-6">{market.error.message}</p>}
      {!market.isPending && !market.error && !items.length && <p className="border border-black p-10 text-center">No works in this loaded page match those filters.</p>}
      <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
        {items.map((item, index) => <MarketCard key={`${item.commerce.chainId}:${item.commerce.id}`} item={item} priority={index < 4} />)}
      </div>
      <nav aria-label="Inventory pages" className="cryptoart-mono mt-16 flex items-center justify-between border-t border-black pt-5 text-xs uppercase">
        {page > 1 ? <button type="button" onClick={() => update('page', String(page - 1))}>← Previous</button> : <span />}
        <span>Page {page}</span>
        {market.data?.pagination.hasMore ? <button type="button" onClick={() => update('page', String(page + 1))}>Next →</button> : <span />}
      </nav>
    </section>
  </main>;
}
