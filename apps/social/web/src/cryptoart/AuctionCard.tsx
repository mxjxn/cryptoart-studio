import type { AuctionCardData } from './marketplace';
import { personLabel } from './marketplace';

export function AuctionCard({ auction }: { auction: AuctionCardData }) {
  const sold = auction.kind === 'recent-sale';
  const sentence = sold && auction.buyer
    ? <><strong>{personLabel(auction.buyer)}</strong> acquired <em>{auction.title}</em> from {personLabel(auction.seller)} for {auction.amount} {auction.currency}.</>
    : <><strong>{personLabel(auction.seller)}</strong> presents <em>{auction.title}</em>, now at auction with a {auction.amount} {auction.currency} reserve.</>;

  if (sold) return <aside className="border-y border-default bg-elevated/40 px-5 py-7 sm:px-8" aria-label="Recent acquisition">
    <a href={auction.href} className="group grid grid-cols-[88px_1fr] items-center gap-5 sm:grid-cols-[120px_1fr]">
      {auction.imageUrl && <img src={auction.imageUrl} alt={auction.title} className="aspect-square w-full bg-black object-contain" />}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-green-500">Recent acquisition · {auction.chainId === 1 ? 'Ethereum' : 'Base'}</p>
        <p className="font-serif text-lg leading-7 sm:text-xl">{sentence}</p>
        <p className="mt-3 text-sm text-muted group-hover:underline">View sale →</p>
      </div>
    </a>
  </aside>;

  return <article className="px-4 pb-14 pt-8 sm:px-8 sm:pb-20 sm:pt-12">
    <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-action-purple">On view · Featured auction</p>
    <a href={auction.href} className="group block">
      {auction.imageUrl && <div className="bg-black shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        <img src={auction.imageUrl} alt={auction.title} className="mx-auto max-h-[68vh] w-full object-contain" />
      </div>}
      <div className="mx-auto mt-6 max-w-xl text-center">
        <h1 className="font-serif text-3xl italic leading-tight sm:text-4xl">{auction.title}</h1>
        <p className="mt-3 text-base leading-7 text-muted">{sentence}</p>
        {auction.description && <p className="mx-auto mt-3 line-clamp-2 max-w-lg text-sm leading-6 text-muted">{auction.description}</p>}
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.12em] group-hover:underline">Enter auction →</p>
      </div>
    </a>
  </article>;
}
