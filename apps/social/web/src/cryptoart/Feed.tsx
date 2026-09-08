import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Cast } from '~/components/casts/Cast';
import { buildCastsWithContext } from '~/utils/castUtils';
import { AuctionCard } from './AuctionCard';
import { composeExhibition, type RankedSocialItem } from './exhibition';
import type { AuctionCardData } from './marketplace';
import { APPROVED_CHANNELS } from './policy';

interface FeedPage {
  items: RankedSocialItem[];
  auctions: AuctionCardData[];
  warnings: string[];
  snapshotAt: number;
  nextCursor: string | null;
}

const conversationHref = (hash: string) => `/~/conversations/${hash}`;
const name = (item: RankedSocialItem) => item.candidate.cast.author.displayName || item.candidate.cast.author.username || `FID ${item.candidate.cast.author.fid}`;
const username = (item: RankedSocialItem) => item.candidate.cast.author.username ? `@${item.candidate.cast.author.username}` : `FID ${item.candidate.cast.author.fid}`;

function SectionTitle({ eyebrow, children }: { eyebrow: string; children: string }) {
  return <header className="px-4 pb-6 pt-14 sm:px-8 sm:pt-20">
    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">{eyebrow}</p>
    <h2 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">{children}</h2>
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-action-purple">{item.score.curation > 0 ? 'Selected by @mxjxn' : `Community response · ${item.candidate.likes} appreciations`} · /{item.candidate.channel}</p>
        <h3 className="mt-2 font-serif text-xl leading-snug">{name(item)}</h3>
        <p className="mt-1 text-xs text-muted">{username(item)}</p>
        {cast.text && <p className="mt-3 line-clamp-3 text-sm leading-6">{cast.text}</p>}
        <p className="mt-3 text-xs text-muted">{item.candidate.likes} appreciations · {item.candidate.replies} replies</p>
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

  return <main>
    <div className="border-b border-default px-4 py-5 sm:px-8">
      <div className="flex items-end justify-between gap-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">Exhibition feed · updated continuously</p>
          <p className="mt-2 max-w-md font-serif text-lg leading-7">Art and conversation selected from trusted corners of Farcaster.</p>
        </div>
        <button type="button" className="shrink-0 text-xs uppercase tracking-[0.12em] underline" disabled={feed.isFetching} onClick={() => void feed.refetch()}>Refresh</button>
      </div>
      <nav aria-label="Exhibition channels" className="mt-5 flex gap-4 overflow-x-auto pb-1 text-sm">
        {['', ...APPROVED_CHANNELS].map(value => <button key={value} type="button" aria-pressed={channel === value} onClick={() => setChannel(value)}
          className={`shrink-0 border-b pb-1 ${channel === value ? 'border-current font-semibold' : 'border-transparent text-muted hover:text-default'}`}>
          {value ? `/${value}` : 'All rooms'}
        </button>)}
      </nav>
    </div>

    {feed.isPending && <p role="status" className="p-8">Preparing the exhibition…</p>}
    {feed.error && <p role="alert" className="p-8">{feed.error.message}</p>}
    {warnings.length > 0 && <details className="px-8 py-3 text-xs text-muted"><summary>Some sources are incomplete</summary>
      <ul>{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>}
    {!feed.isPending && !feed.error && !items.length && <p className="p-8">No work is available in these rooms yet.</p>}

    {featured.map(auction => <AuctionCard key={`${auction.kind}:${auction.chainId}:${auction.listingId}`} auction={auction} />)}

    {exhibition.selected.length > 0 && <section aria-labelledby="community-selections">
      <SectionTitle eyebrow="Curator signal">Community selections</SectionTitle>
      <div id="community-selections" className="grid grid-cols-1 gap-x-5 gap-y-12 px-4 pb-16 sm:grid-cols-2 sm:px-8">
        {exhibition.selected.map(item => <SelectedCast key={item.candidate.hash} item={item} />)}
      </div>
    </section>}

    {sales.map(auction => <AuctionCard key={`${auction.kind}:${auction.chainId}:${auction.listingId}`} auction={auction} />)}

    {exhibition.arrivals.length > 0 && <section aria-labelledby="new-arrivals">
      <SectionTitle eyebrow="Discovery room">New arrivals</SectionTitle>
      <div id="new-arrivals" className="grid grid-cols-2 gap-x-3 gap-y-7 px-4 pb-14 sm:grid-cols-3 sm:gap-x-4 sm:px-8">
        {exhibition.arrivals.map(item => <ArrivalCast key={item.candidate.hash} item={item} />)}
      </div>
    </section>}

    {exhibition.conversations.length > 0 && <section aria-labelledby="conversations">
      <SectionTitle eyebrow="The reading room">Conversations</SectionTitle>
      <div id="conversations" className="space-y-4 px-4 pb-16 sm:px-8">
        {exhibition.conversations.map(item => <FullCast key={item.candidate.hash} item={item} />)}
      </div>
    </section>}

    {exhibition.remainder.length > 0 && <section aria-labelledby="more-from-the-rooms">
      <SectionTitle eyebrow="Approved channels">More from the rooms</SectionTitle>
      <div id="more-from-the-rooms" className="px-4 pb-12 sm:px-8">
        {exhibition.remainder.map(item => <ArchiveCast key={item.candidate.hash} item={item} />)}
      </div>
    </section>}

    {feed.hasNextPage && <div className="px-4 pb-20 text-center sm:px-8"><button type="button" className="border border-default px-7 py-3 text-xs font-semibold uppercase tracking-[0.14em]"
      disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
      {feed.isFetchingNextPage ? 'Preparing more…' : 'Enter the next room'}
    </button></div>}
  </main>;
}
