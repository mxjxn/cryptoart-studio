import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Heart, MessageCircle, Repeat2 } from 'lucide-react';
import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { ActivityRail } from './ActivityRail';
import { CryptoartHeader } from './CryptoartHeader';
import { composeExhibition, type RankedSocialItem } from './exhibition';
import { CreatorRail } from './CreatorRail';
import type { AuctionCardData, MarketplaceListingData } from './marketplace';
import { useSiweSession } from './useSiweSession';

interface FeedPage {
  mode: 'curated' | 'mixed';
  items: RankedSocialItem[];
  auctions: AuctionCardData[];
  latestListings: MarketplaceListingData[];
  warnings: string[];
  snapshotAt: number;
  nextCursor: string | null;
}

function useViewerFid() {
  const { address, isConnected } = useAccount();
  const { session } = useSiweSession();
  const listed = useQuery({
    queryKey: ['cryptoart-account-fid', address],
    enabled: Boolean(isConnected && address),
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/cryptoart/account?address=${address}`, { signal });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Directory lookup failed.');
      const body = await response.json() as { fid?: number };
      return typeof body.fid === 'number' ? body.fid : null;
    },
    staleTime: 60_000,
    retry: false,
  });
  return session.data?.fid ?? listed.data ?? null;
}

const name = (item: RankedSocialItem) => item.candidate.cast.author.displayName || item.candidate.cast.author.username || `FID ${item.candidate.cast.author.fid}`;
const username = (item: RankedSocialItem) => item.candidate.cast.author.username ? `@${item.candidate.cast.author.username}` : `FID ${item.candidate.cast.author.fid}`;

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(n);
}

function PostCard({ item }: { item: RankedSocialItem }) {
  const cast = item.candidate.cast;
  const image = cast.embeds?.images?.[0];
  const pfp = cast.author.pfp?.url;
  return <article className="border-b border-[#2a2a2a] px-3 py-3 sm:px-4">
    <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-2.5">
      {pfp
        ? <img src={pfp} alt="" className="h-9 w-9 rounded-full bg-[#222] object-cover" />
        : <span className="h-9 w-9 rounded-full bg-[#222]" />}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[13px] leading-tight">
          <span className="font-medium">{name(item)}</span>
          <span className="text-[#888]">{username(item)}</span>
          {item.score.curation > 0 && <span className="cryptoart-mono text-[10px] uppercase tracking-[0.08em] text-[#dcf54c]">Selected</span>}
        </div>
        {cast.text && <p className="mt-1 whitespace-pre-wrap text-[14px] leading-5 text-[#e8e8e8]">{cast.text}</p>}
        {image && <div className="mt-2 inline-block max-w-full overflow-hidden rounded-md border border-[#2a2a2a]">
          <img
            src={image.url}
            alt={image.alt || cast.text || `Work shared by ${name(item)}`}
            className="block max-h-[280px] max-w-full h-auto w-auto"
          />
        </div>}
        <div className="mt-2 flex items-center gap-5 text-[#888]">
          <span className="inline-flex items-center gap-1.5 text-[12px]" title="Replies">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
            <span className="sr-only">Replies</span>
            {formatCount(item.candidate.replies)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12px]" title="Recasts">
            <Repeat2 className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
            <span className="sr-only">Recasts</span>
            {formatCount(item.candidate.recasts)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12px]" title="Likes">
            <Heart className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
            <span className="sr-only">Likes</span>
            {formatCount(item.candidate.likes)}
          </span>
        </div>
      </div>
    </div>
  </article>;
}

export function CryptoartFeed() {
  const viewerFid = useViewerFid();
  const feed = useInfiniteQuery({
    queryKey: ['cryptoart-feed', viewerFid],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }): Promise<FeedPage> => {
      const params = new URLSearchParams();
      if (pageParam) params.set('cursor', pageParam);
      if (viewerFid) params.set('fid', String(viewerFid));
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
  const mode = feed.data?.pages[0]?.mode ?? (viewerFid ? 'mixed' : 'curated');
  const items = useMemo(() => feed.data?.pages.flatMap(page => page.items) ?? [], [feed.data]);
  const exhibition = useMemo(() => composeExhibition(items), [items]);
  const posts = useMemo(() => [
    ...exhibition.selected,
    ...exhibition.conversations,
    ...exhibition.miniApps,
    ...exhibition.arrivals,
    ...exhibition.remainder,
  ], [exhibition]);
  const warnings = [...new Set(feed.data?.pages.flatMap(page => page.warnings) ?? [])];
  const auctions = feed.data?.pages[0]?.auctions ?? [];
  const featured = auctions.filter(auction => auction.kind === 'featured-auction');
  const sales = auctions.filter(auction => auction.kind === 'recent-sale');
  const latestListings = (feed.data?.pages[0]?.latestListings ?? []).filter(
    listing => !featured.some(auction => auction.chainId === listing.chainId && auction.listingId === listing.listingId),
  );
  const liveLots: MarketplaceListingData[] = [
    ...featured.map(auction => ({
      chainId: auction.chainId,
      listingId: auction.listingId,
      listingType: 'INDIVIDUAL_AUCTION' as const,
      title: auction.title,
      imageUrl: auction.imageUrl,
      href: auction.href,
      amount: auction.amount,
      currency: auction.currency,
      available: 1,
      bidCount: auction.bidCount,
      createdAt: auction.timestamp,
    })),
    ...latestListings,
  ];

  return <main className="cryptoart-shell min-h-screen bg-black text-white">
    <CryptoartHeader active="feed" />
    <div className="cryptoart-desk mx-auto grid max-w-[1280px] lg:grid-cols-[220px_minmax(0,1fr)_240px]">
      <ActivityRail liveLots={liveLots} recentSales={sales} />

      <section className="min-w-0 border-[#2a2a2a] lg:border-x" aria-label="Conversation">
        <div className="flex items-center justify-between gap-3 border-b border-[#2a2a2a] px-3 py-2 sm:px-4">
          <div className="flex items-baseline gap-2">
            <p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em]">Conversation</p>
            <p className="cryptoart-mono text-[10px] uppercase tracking-[0.1em] text-[#666]">
              {mode === 'mixed' ? 'Following · curated' : 'Curated'}
            </p>
          </div>
          <button type="button" className="cryptoart-mono text-[10px] uppercase underline disabled:opacity-40" disabled={feed.isFetching} onClick={() => void feed.refetch()}>
            Refresh
          </button>
        </div>

        {feed.isPending && <p role="status" className="px-4 py-6 text-sm text-[#aaa]">Loading the feed…</p>}
        {feed.error && <p role="alert" className="px-4 py-6 text-sm">{feed.error.message}</p>}
        {warnings.length > 0 && <details className="border-b border-[#2a2a2a] px-4 py-2 text-xs text-[#888]"><summary>Some sources are incomplete</summary>
          <ul>{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
        </details>}

        {!feed.isPending && !feed.error && posts.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-[#ccc]">No posts in this stream right now.</p>
            <a href="/market" className="cryptoart-mono mt-3 inline-block text-[10px] uppercase tracking-[0.12em] text-[#888] underline hover:text-white">Market →</a>
          </div>
        )}

        {posts.map(item => <PostCard key={item.candidate.hash} item={item} />)}

        {feed.hasNextPage && <div className="border-t border-[#2a2a2a] py-3 text-center">
          <button type="button" className="cryptoart-mono text-[10px] uppercase tracking-[0.12em] underline disabled:opacity-40"
            disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
            {feed.isFetchingNextPage ? 'Loading…' : 'Show more'}
          </button>
        </div>}
      </section>

      <div className="lg:contents">
        <div className="border-t border-[#2a2a2a] px-3 py-2 lg:hidden">
          <p className="cryptoart-mono text-[10px] uppercase tracking-[0.14em] text-[#888]">Create</p>
        </div>
        <CreatorRail />
      </div>
    </div>
  </main>;
}
