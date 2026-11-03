import { useQuery } from '@tanstack/react-query';
import type { Exhibition } from './domain';
import { editorialExhibition } from './exhibitionFixture';
import { localListingHref } from './listingClient';

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

function RailHeading({ children }: { children: string }) {
  return <p className="cryptoart-mono mb-2 text-[10px] uppercase tracking-[0.14em] text-[#888]">{children}</p>;
}

const TOOLING = [
  { label: 'Mint & durable media', detail: 'Studio · Arweave fees', href: 'https://cryptoart.studio', state: 'ready' as const },
  { label: 'Lazy minting', detail: 'Gas when collected', href: 'https://cryptoart.studio', state: 'next' as const },
  { label: 'Creator coins', detail: 'Clanker', href: 'https://github.com/clanker-devco/clanker-sdk', state: 'soon' as const },
  { label: 'Subscriptions', detail: 'STP', href: 'https://github.com/mxjxn/stp-v2', state: 'soon' as const },
];

/** Right desk rail: create path + editorial. Not a mirror of Activity. */
export function CreatorRail() {
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
  const featured = exhibition.placements.slice(0, 2);

  return <aside className="cryptoart-creator border-t border-[#333] bg-[#0c0c0c] lg:border-l lg:border-t-0" aria-label="Create">
    <div className="sticky top-0 max-h-screen space-y-5 overflow-y-auto p-3 sm:p-4">
      <section className="border-2 border-black bg-[#dcf54c] p-3 text-black">
        <p className="cryptoart-mono text-[10px] uppercase tracking-[0.14em]">Create</p>
        <p className="mt-2 text-[15px] font-medium leading-snug tracking-[-0.02em]">
          Mint work, then list it here.
        </p>
        <p className="mt-2 text-[12px] leading-5 text-black/70">
          Studio handles collection deploy and durable Arweave media. Pay storage, publish the token, bring it back to Social to talk and sell.
        </p>
        <a
          href="https://cryptoart.studio"
          className="mt-3 inline-block border-2 border-black bg-black px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#dcf54c] hover:bg-transparent hover:text-black"
        >
          Open Studio ↗
        </a>
      </section>

      <section>
        <RailHeading>On the way</RailHeading>
        <ul className="space-y-2">
          {TOOLING.map(tool => (
            <li key={tool.label}>
              <a href={tool.href} className="group flex items-baseline justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] leading-tight group-hover:underline">{tool.label}</span>
                  <span className="cryptoart-mono text-[10px] text-[#888]">{tool.detail}</span>
                </span>
                <span className="cryptoart-mono shrink-0 text-[9px] uppercase tracking-[0.1em] text-[#666]">
                  {tool.state === 'ready' ? 'Open' : tool.state === 'next' ? 'Next' : 'Soon'}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <RailHeading>On view</RailHeading>
        <a href={`/exhibitions/${exhibition.slug}`} className="group block">
          <p className="text-[15px] font-medium leading-tight tracking-[-0.02em] group-hover:underline">{exhibition.title}</p>
          <p className="cryptoart-mono mt-0.5 text-[10px] text-[#888]">curated by {exhibition.curator}</p>
        </a>
        <ul className="mt-2">
          {featured.map(placement => (
            <li key={placement.id}>
              <a
                href={placement.commerce?.href ?? `/exhibitions/${exhibition.slug}`}
                className="group grid grid-cols-[36px_1fr] items-center gap-2.5 py-1.5"
              >
                {placement.artwork.media.previewUrl
                  ? <img src={placement.artwork.media.previewUrl} alt="" className="h-9 w-9 bg-black object-cover" />
                  : <span className="h-9 w-9 bg-[#222]" />}
                <span className="min-w-0">
                  <span className="block truncate text-[13px] leading-tight group-hover:underline">{placement.artwork.title}</span>
                  <span className="cryptoart-mono text-[10px] text-[#888]">
                    {placement.commerce
                      ? `${placement.commerce.amount || '—'} ${placement.commerce.currency}`
                      : placement.artwork.artist ?? 'In exhibition'}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <a href="/create" className="cryptoart-mono inline-block text-[10px] uppercase tracking-[0.12em] text-[#888] underline hover:text-white">
        List existing work →
      </a>
    </div>
  </aside>;
}
