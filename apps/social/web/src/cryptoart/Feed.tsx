import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Cast } from '~/components/casts/Cast';
import { buildCastsWithContext } from '~/utils/castUtils';
import { AuctionCard } from './AuctionCard';
import { composeExhibition, type RankedSocialItem } from './exhibition';
import { MarketplaceGrid } from './MarketplaceGrid';
import type { AuctionCardData, MarketplaceListingData } from './marketplace';
import { APPROVED_CHANNELS } from './policy';

interface FeedPage {
  items: RankedSocialItem[];
  auctions: AuctionCardData[];
  latestListings: MarketplaceListingData[];
  warnings: string[];
  snapshotAt: number;
  nextCursor: string | null;
}

const conversationHref = (hash: string) => `/~/conversations/${hash}`;
const name = (item: RankedSocialItem) => item.candidate.cast.author.displayName || item.candidate.cast.author.username || `FID ${item.candidate.cast.author.fid}`;
const username = (item: RankedSocialItem) => item.candidate.cast.author.username ? `@${item.candidate.cast.author.username}` : `FID ${item.candidate.cast.author.fid}`;

function SectionTitle({ eyebrow, children }: { eyebrow: string; children: string }) {
  return <header className="px-4 pb-6 pt-10 sm:px-8 lg:px-12">
    <p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em] text-muted">{eyebrow}</p>
    <h2 className="mt-1 text-[clamp(2.6rem,8vw,5.5rem)] font-medium leading-[0.88] tracking-[-0.04em]">{children}</h2>
  </header>;
}

function SelectedCast({ item }: { item: RankedSocialItem }) {
  const cast = item.candidate.cast;
  const image = cast.embeds?.images?.[0];
  return <article className="min-w-0">
    <a href={conversationHref(cast.hash)} className="group block">
      {image && <div className="flex aspect-[4/5] items-center bg-black">
        <img src={image.url} alt={image.alt || cast.text || `Work shared by ${name(item)}`} className="max-h-full w-full object-contain" />
      </div>}
      <div className="pt-4">
        <p className="cryptoart-mono text-[10px] uppercase tracking-[0.1em]">{item.score.curation > 0 ? 'Selected by @mxjxn' : `Community response · ${item.candidate.likes} appreciations`} · /{item.candidate.channel}</p>
        <h3 className="mt-2 text-xl font-medium leading-snug">{name(item)}</h3>
        <p className="cryptoart-mono mt-1 text-xs opacity-60">{username(item)}</p>
        {cast.text && <p className="mt-3 line-clamp-3 text-sm leading-6">{cast.text}</p>}
        <p className="cryptoart-mono mt-3 text-xs opacity-60">{item.candidate.likes} appreciations · {item.candidate.replies} replies</p>
      </div>
    </a>
  </article>;
}

function ArrivalCast({ item }: { item: RankedSocialItem }) {
  const cast = item.candidate.cast;
  const image = cast.embeds?.images?.[0];
  return <article className="min-w-0">
    <a href={conversationHref(cast.hash)} className="group block">
      {image && <div className="flex aspect-square items-center bg-black">
        <img src={image.url} alt={image.alt || cast.text || `Work shared by ${name(item)}`} className="max-h-full w-full object-contain transition-opacity group-hover:opacity-90" />
      </div>}
      <p className="mt-2 truncate text-xs font-semibold">{name(item)}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted">/{item.candidate.channel} · {item.lane === 'latest' ? 'new' : `${item.candidate.likes} appreciations`}</p>
    </a>
  </article>;
}

function FullCast({ item }: { item: RankedSocialItem }) {
  const context = buildCastsWithContext([{ cast: item.candidate.cast }], { showChannelTag: true })[0];
  if (!context) return null;
  return <div className="overflow-hidden border border-default bg-elevated"><Cast castWithContext={context} /></div>;
}

function ArchiveCast({ item }: { item: RankedSocialItem }) {
  const cast = item.candidate.cast;
  const image = cast.embeds?.images?.[0];
  return <article className="border-t border-default py-4 first:border-t-0">
    <a href={conversationHref(cast.hash)} className="group grid grid-cols-[1fr_auto] gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold">{name(item)} <span className="font-normal text-muted">· /{item.candidate.channel}</span></p>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted group-hover:text-default">{cast.text || 'Shared a work'}</p>
      </div>
      {image && <img src={image.url} alt="" className="h-14 w-14 bg-black object-cover" />}
    </a>
  </article>;
}

export function CryptoartFeed() {
  const [channel, setChannel] = useState('');
  const feed = useInfiniteQuery({
    queryKey: ['cryptoart-feed', channel],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }): Promise<FeedPage> => {
      const params = new URLSearchParams();
      if (channel) params.set('channel', channel);
      if (pageParam) params.set('cursor', pageParam);
      const response = await fetch(`/api/cryptoart/feed?${params}`, { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'The feed could not be loaded.');
      return data;
    },
    getNextPageParam: page => page.nextCursor ?? undefined,
    retry: false,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
  const items = useMemo(() => feed.data?.pages.flatMap(page => page.items) ?? [], [feed.data]);
  const exhibition = useMemo(() => composeExhibition(items), [items]);
  const warnings = [...new Set(feed.data?.pages.flatMap(page => page.warnings) ?? [])];
  const auctions = feed.data?.pages[0]?.auctions ?? [];
  const featured = auctions.filter(auction => auction.kind === 'featured-auction');
  const sales = auctions.filter(auction => auction.kind === 'recent-sale');
  const latestListings = (feed.data?.pages[0]?.latestListings ?? []).filter(
    listing => !featured.some(auction => auction.chainId === listing.chainId && auction.listingId === listing.listingId),
  );

  return <main className="cryptoart-shell overflow-hidden bg-black text-white">
    <a href="https://cryptoart.social/membership" className="cryptoart-mono block bg-[#f5b0d3] px-4 py-2 text-center text-[11px] font-medium text-black sm:text-xs">
      Support infrastructure &amp; open-source behind cryptoart.social&nbsp;&nbsp; 0.0001 ETH / month
    </a>
    <header className="border-b border-[#333] bg-black px-4 pb-0 pt-5 sm:px-8 lg:px-12">
      <div className="cryptoart-mono flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-[#aaa]">
        <span>Live social index · 7 channels</span>
        <div className="flex gap-4"><a href="https://cryptoart.social/market" className="hover:text-white">Market</a><a href="https://cryptoart.social/galleries" className="hover:text-white">Galleries</a><a href="/~/sign-in-with-farcaster" className="hover:text-white">Sign in</a></div>
      </div>
      <div className="grid items-end gap-5 py-8 md:grid-cols-[minmax(0,1.4fr)_minmax(230px,0.6fr)] md:py-12">
        <a href="/" aria-label="Cryptoart Social home"><img src="/cryptoart-logo-wgmeets.png" alt="Cryptoart" className="w-full max-w-[650px]" /></a>
        <div className="border-l-2 border-white pl-4 md:mb-2">
          <p className="text-[clamp(2rem,7vw,4.5rem)] font-medium leading-[0.78] tracking-[-0.06em]">SOCIAL</p>
          <p className="cryptoart-mono mt-4 text-xs leading-5 text-[#aaa]">Farcaster as an exhibition, marketplace and public conversation.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 border-x border-t border-[#444] sm:grid-cols-4">
        <a href="/" className="bg-white px-4 py-3 text-center text-sm font-medium !text-black">Feed</a>
        <a href="https://cryptoart.social/market" className="border-l border-[#444] px-4 py-3 text-center text-sm hover:bg-white hover:!text-black">Market</a>
        <a href="https://cryptoart.social/galleries" className="border-l border-t border-[#444] px-4 py-3 text-center text-sm hover:bg-white hover:!text-black sm:border-t-0">Galleries</a>
        <a href="https://cryptoart.social/create" className="border-l border-t border-[#444] px-4 py-3 text-center text-sm hover:bg-white hover:!text-black sm:border-t-0">Create listing</a>
      </div>
    </header>
    <div className="bg-[#dcf54c] px-4 py-3 text-black sm:px-8 lg:px-12">
      <div className="flex items-center justify-between gap-4">
        <p className="cryptoart-mono shrink-0 text-[11px] uppercase tracking-[0.1em]">Channel index</p>
        <button type="button" className="cryptoart-mono shrink-0 text-[11px] uppercase underline" disabled={feed.isFetching} onClick={() => void feed.refetch()}>Refresh</button>
      </div>
      <nav aria-label="Exhibition channels" className="mt-3 flex gap-5 overflow-x-auto pb-1 text-sm">
        {['', ...APPROVED_CHANNELS].map(value => <button key={value} type="button" aria-pressed={channel === value} onClick={() => setChannel(value)}
          className={`shrink-0 border-b border-black pb-1 text-black ${channel === value ? 'font-bold' : 'border-transparent opacity-60 hover:opacity-100'}`}>
          {value ? `/${value}` : 'All channels'}
        </button>)}
      </nav>
    </div>

    {feed.isPending && <p role="status" className="p-8">Preparing the exhibition…</p>}
    {feed.error && <p role="alert" className="p-8">{feed.error.message}</p>}
    {warnings.length > 0 && <details className="px-8 py-3 text-xs text-muted"><summary>Some sources are incomplete</summary>
      <ul>{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>}
    {!feed.isPending && !feed.error && !items.length && <p className="p-8">No work is available in these rooms yet.</p>}

    {featured.map(auction => <AuctionCard key={`${auction.kind}:${auction.chainId}:${auction.listingId}`} auction={auction} />)}

    {exhibition.selected.length > 0 && <section aria-labelledby="community-selections" className="bg-[#f5b0d3] text-black">
      <SectionTitle eyebrow="Curator signal">Community selections</SectionTitle>
      <div id="community-selections" className="grid grid-cols-1 gap-x-5 gap-y-12 px-4 pb-16 sm:grid-cols-2 sm:px-8 lg:px-12">
        {exhibition.selected.map(item => <SelectedCast key={item.candidate.hash} item={item} />)}
      </div>
    </section>}

    {sales.map(auction => <AuctionCard key={`${auction.kind}:${auction.chainId}:${auction.listingId}`} auction={auction} />)}

    <MarketplaceGrid listings={latestListings} />

    {exhibition.miniApps.length > 0 && <section aria-labelledby="interactive-works">
      <SectionTitle eyebrow="Participatory works">Interactive</SectionTitle>
      <div id="interactive-works" className="grid gap-4 px-4 pb-16 sm:px-8 lg:grid-cols-2 lg:px-12">
        {exhibition.miniApps.map(item => <FullCast key={item.candidate.hash} item={item} />)}
      </div>
    </section>}

    {exhibition.arrivals.length > 0 && <section aria-labelledby="new-arrivals">
      <SectionTitle eyebrow="Discovery room">New arrivals</SectionTitle>
      <div id="new-arrivals" className="grid grid-cols-2 gap-x-3 gap-y-7 px-4 pb-14 sm:grid-cols-3 sm:gap-x-4 sm:px-8 lg:grid-cols-4 lg:px-12">
        {exhibition.arrivals.map(item => <ArrivalCast key={item.candidate.hash} item={item} />)}
      </div>
    </section>}

    {exhibition.conversations.length > 0 && <section aria-labelledby="conversations">
      <SectionTitle eyebrow="The reading room">Conversations</SectionTitle>
      <div id="conversations" className="mx-auto max-w-[720px] space-y-4 px-4 pb-16 sm:px-8">
        {exhibition.conversations.map(item => <FullCast key={item.candidate.hash} item={item} />)}
      </div>
    </section>}

    {exhibition.remainder.length > 0 && <section aria-labelledby="more-from-the-rooms">
      <SectionTitle eyebrow="Approved channels">More from the rooms</SectionTitle>
      <div id="more-from-the-rooms" className="grid px-4 pb-12 sm:grid-cols-2 sm:gap-x-8 sm:px-8 lg:px-12">
        {exhibition.remainder.map(item => <ArchiveCast key={item.candidate.hash} item={item} />)}
      </div>
    </section>}

    {feed.hasNextPage && <div className="px-4 pb-20 text-center sm:px-8"><button type="button" className="border border-default px-7 py-3 text-xs font-semibold uppercase tracking-[0.14em]"
      disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
      {feed.isFetchingNextPage ? 'Preparing more…' : 'Enter the next room'}
    </button></div>}
  </main>;
}
