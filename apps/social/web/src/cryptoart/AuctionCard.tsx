import type { AuctionCardData } from './marketplace';
import { personLabel } from './marketplace';

export function AuctionCard({ auction }: { auction: AuctionCardData }) {
  const sold = auction.kind === 'recent-sale';
  const sentence = sold && auction.buyer
    ? <><strong>{personLabel(auction.buyer)}</strong> won <em>{auction.title}</em> from {personLabel(auction.seller)} for {auction.amount} {auction.currency}.</>
    : <><strong>{personLabel(auction.seller)}</strong> is auctioning <em>{auction.title}</em> with a {auction.amount} {auction.currency} reserve.</>;
  return <article className="border-b border-default p-4">
    <a href={auction.href} className="group block overflow-hidden rounded-2xl border border-default bg-elevated">
      {auction.imageUrl && <img src={auction.imageUrl} alt={auction.title} className="aspect-[4/3] w-full bg-black object-contain" />}
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide">
          <span className={sold ? 'text-green-500' : 'text-action-purple'}>{sold ? 'Recently sold' : 'Featured auction'}</span>
          <span>{auction.chainId === 1 ? 'Ethereum' : 'Base'}</span>
        </div>
        <p className="text-base leading-6">{sentence}</p>
        {auction.description && <p className="line-clamp-2 text-sm text-muted">{auction.description}</p>}
        <p className="text-sm font-semibold group-hover:underline">{sold ? 'View the sale' : 'View auction and bid'} →</p>
      </div>
    </a>
  </article>;
}
