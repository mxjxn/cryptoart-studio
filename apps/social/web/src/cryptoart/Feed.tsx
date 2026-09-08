import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Cast } from '~/components/casts/Cast';
import { buildCastsWithContext } from '~/utils/castUtils';
import { APPROVED_CHANNELS } from './policy';
import type { SocialCandidate } from './neynar';
import type { scoreCast } from './ranking';
import type { AuctionCardData } from './marketplace';
import { AuctionCard } from './AuctionCard';

interface FeedPage {
  items: { candidate: SocialCandidate; lane: 'popular' | 'latest'; score: ReturnType<typeof scoreCast> }[];
  auctions: AuctionCardData[];
  warnings: string[];
  snapshotAt: number;
  nextCursor: string | null;
}

/** The original Farcaster Cast component renders the new ranked source. */
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
  const warnings = [...new Set(feed.data?.pages.flatMap(page => page.warnings) ?? [])];
  const auctions = feed.data?.pages[0]?.auctions ?? [];
  const featured = auctions.filter(auction => auction.kind === 'featured-auction');
  const sales = auctions.filter(auction => auction.kind === 'recent-sale');
  return <>
    <nav aria-label="Feed channels" className="flex flex-wrap gap-2 border-b border-default p-4">
      {['', ...APPROVED_CHANNELS].map(value => <button key={value} type="button"
        aria-pressed={channel === value} onClick={() => setChannel(value)}
        className={`rounded-full border px-3 py-1 text-sm ${channel === value ? 'bg-purple-600 text-white border-purple-600' : 'border-default'}`}>
        {value ? `/${value}` : 'All channels'}
      </button>)}
    </nav>
    <div className="flex items-center justify-between gap-3 border-b border-default px-4 py-3 text-sm">
      <p>Popular in the last 24 hours, mixed with latest</p>
      <button type="button" className="underline" disabled={feed.isFetching} onClick={() => void feed.refetch()}>Refresh</button>
    </div>
    {feed.isPending && <p role="status" className="p-6">Loading art and conversations…</p>}
    {feed.error && <p role="alert" className="p-6">{feed.error.message}</p>}
    {warnings.length > 0 && <details className="p-4 text-sm"><summary>Some feed sources are incomplete</summary>
      <ul>{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>}
    {!feed.isPending && !feed.error && !items.length && <p className="p-6">No casts are available in these channels yet.</p>}
    {featured.map(auction => <AuctionCard key={`${auction.kind}:${auction.chainId}:${auction.listingId}`} auction={auction} />)}
    {items.map(({ candidate, lane, score }, index) => {
      const context = buildCastsWithContext([{ cast: candidate.cast }], { showChannelTag: true })[0];
      if (!context) return null;
      return <div key={candidate.hash}>
        <Cast castWithContext={context} />
        {candidate.listings.map(listing => <a key={`${listing.chainId}:${listing.listingId}`} href={listing.url}
          className="mx-4 mb-3 block rounded-lg border border-default p-3 text-sm">
          View Cryptoart listing #{listing.listingId} · {listing.chainId === 1 ? 'Ethereum' : 'Base'}
        </a>)}
        {import.meta.env.DEV && <details className="border-b border-default px-4 pb-2 text-xs text-muted">
          <summary>Ranking: {lane}</summary>
          Engagement {score.engagement.toFixed(2)} · weighted likes {score.curation} · active listing {score.listing}
        </details>}
        {index === 2 && sales.map(auction => <AuctionCard key={`${auction.kind}:${auction.chainId}:${auction.listingId}`} auction={auction} />)}
      </div>;
    })}
    {feed.hasNextPage && <button type="button" className="m-4 rounded-lg border border-default px-4 py-2"
      disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
      {feed.isFetchingNextPage ? 'Loading…' : 'Load more'}
    </button>}
  </>;
}
