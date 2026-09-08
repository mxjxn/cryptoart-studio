import type { AuctionCardData } from './marketplace';
import { personLabel } from './marketplace';

export function AuctionCard({ auction }: { auction: AuctionCardData }) {
  const sold = auction.kind === 'recent-sale';
  const sentence = sold && auction.buyer
    ? <><strong>{personLabel(auction.buyer)}</strong> acquired <em>{auction.title}</em> from {personLabel(auction.seller)} for {auction.amount} {auction.currency}.</>
    : <><strong>{personLabel(auction.seller)}</strong> presents <em>{auction.title}</em>, now at auction with a {auction.amount} {auction.currency} reserve.</>;

  if (sold) return <aside className="border-y border-black bg-white px-5 py-7 text-black sm:px-8 lg:px-12" aria-label="Recent acquisition">
    <a href={auction.href} className="group grid grid-cols-[88px_1fr] items-center gap-5 sm:grid-cols-[120px_1fr]">
      {auction.imageUrl && <img src={auction.imageUrl} alt={auction.title} className="aspect-square w-full bg-black object-contain" />}
      <div>
        <p className="cryptoart-mono mb-2 text-[11px] uppercase tracking-[0.1em] text-neutral-500">Recent acquisition · {auction.chainId === 1 ? 'Ethereum' : 'Base'}</p>
        <p className="text-lg leading-7 sm:text-xl">{sentence}</p>
        <p className="mt-3 text-sm text-neutral-600 group-hover:underline">View sale →</p>
      </div>
    </a>
  </aside>;

  return <article className="bg-[#dcf54c] px-4 pb-8 pt-7 text-black sm:px-8 lg:px-12">
    <p className="text-[clamp(3rem,10vw,7rem)] font-medium leading-[0.82] tracking-[-0.06em] text-black">Featured auction</p>
    <a href={auction.href} className="group mt-6 grid border border-black/20 md:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
      {auction.imageUrl && <div className="flex min-h-[360px] bg-black">
        <img src={auction.imageUrl} alt={auction.title} className="mx-auto max-h-[72vh] w-full object-contain" />
      </div>}
      <div className="flex flex-col justify-between p-5 sm:p-7">
        <p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em] text-black">On view · {auction.chainId === 1 ? 'Ethereum' : 'Base'}</p>
        <div className="my-10">
          <h1 className="text-[clamp(2.5rem,7vw,5rem)] font-medium leading-[0.88] tracking-[-0.05em] text-black">{auction.title}</h1>
          <p className="mt-5 text-base leading-7 text-black">{sentence}</p>
          {auction.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-black/65">{auction.description}</p>}
        </div>
        <p className="border-2 border-black px-5 py-4 text-center text-sm font-medium uppercase tracking-[0.08em] text-black group-hover:bg-black group-hover:text-[#dcf54c]">Enter auction →</p>
      </div>
    </a>
  </article>;
}
