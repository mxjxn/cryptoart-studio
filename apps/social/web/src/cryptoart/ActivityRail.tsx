import { CURATED_RAIL_PICKS } from './policy';
import type { AuctionCardData, MarketplaceListingData } from './marketplace';

function RailHeading({ children }: { children: string }) {
  return <p className="cryptoart-mono mb-2 text-[10px] uppercase tracking-[0.14em] text-[#888]">{children}</p>;
}

function Row({
  href,
  imageUrl,
  title,
  meta,
}: {
  href: string;
  imageUrl?: string;
  title: string;
  meta: string;
}) {
  return <a href={href} className="group grid grid-cols-[36px_minmax(0,1fr)] items-center gap-2.5 py-1.5">
    {imageUrl
      ? <img src={imageUrl} alt="" className="h-9 w-9 bg-black object-cover" />
      : <span className="h-9 w-9 bg-[#222]" />}
    <span className="min-w-0">
      <span className="block truncate text-[13px] leading-tight group-hover:underline">{title}</span>
      <span className="cryptoart-mono block truncate text-[10px] text-[#888]">{meta}</span>
    </span>
  </a>;
}

/** Left desk rail: live market when present, curated cherry-picks as fallback. */
export function ActivityRail({
  liveLots,
  recentSales,
}: {
  liveLots: MarketplaceListingData[];
  recentSales: AuctionCardData[];
}) {
  const lots = liveLots.slice(0, 4);
  const sales = recentSales.slice(0, 3);

  return <aside className="hidden border-r border-[#333] bg-[#0c0c0c] lg:block" aria-label="Activity">
    <div className="sticky top-0 max-h-screen space-y-5 overflow-y-auto p-3 sm:p-4">
      {lots.length > 0 && <section>
        <RailHeading>Live</RailHeading>
        <ul>
          {lots.map(lot => (
            <li key={`live:${lot.chainId}:${lot.listingId}`}>
              <Row href={lot.href} imageUrl={lot.imageUrl} title={lot.title} meta={`${lot.amount} ${lot.currency}`} />
            </li>
          ))}
        </ul>
      </section>}

      {sales.length > 0 && <section>
        <RailHeading>Sold</RailHeading>
        <ul>
          {sales.map(sale => (
            <li key={`sold:${sale.kind}:${sale.chainId}:${sale.listingId}`}>
              <Row href={sale.href} imageUrl={sale.imageUrl} title={sale.title} meta={`${sale.amount} ${sale.currency}`} />
            </li>
          ))}
        </ul>
      </section>}

      <section>
        <RailHeading>Selected</RailHeading>
        <ul>
          {CURATED_RAIL_PICKS.map(pick => (
            <li key={pick.id}>
              <Row
                href={pick.href}
                imageUrl={pick.imageUrl}
                title={pick.title}
                meta={pick.amount ? `${pick.note} · ${pick.amount} ${pick.currency}` : `${pick.note} · ${pick.artist}`}
              />
            </li>
          ))}
        </ul>
      </section>

      <a href="/market" className="cryptoart-mono inline-block text-[10px] uppercase tracking-[0.12em] text-[#888] underline hover:text-white">
        Market →
      </a>
    </div>
  </aside>;
}
