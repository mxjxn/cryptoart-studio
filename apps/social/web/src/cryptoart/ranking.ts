import { FEED_POLICY, isApprovedChannel } from './policy';

export interface Candidate {
  hash: string;
  channel: string;
  timestamp: number;
  likes: number;
  recasts: number;
  replies: number;
  /** Verified current reactions, never a provider's abbreviated liker sample. */
  weightedLikerFids: number[];
  /** Only set by a marketplace resolver, not merely because a URL exists. */
  activeListing?: boolean;
  hidden?: boolean;
}

export function scoreCast(cast: Candidate) {
  const count = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0;
  const engagement = Math.log2(1 + count(cast.likes) * FEED_POLICY.likeWeight +
    count(cast.recasts) * FEED_POLICY.recastWeight + count(cast.replies) * FEED_POLICY.replyWeight);
  const curation = [...new Set(cast.weightedLikerFids)].reduce(
    (sum, fid) => sum + (FEED_POLICY.weightedLikes[fid] ?? 0), 0);
  const listing = cast.activeListing ? FEED_POLICY.activeListingBoost : 0;
  return { total: engagement + curation + listing, engagement, curation, listing };
}

/** Rank one frozen snapshot. Page this result, never independently re-rank each page. */
export function rankFeed<T extends Candidate>(input: T[], now: number) {
  const unique = new Map<string, T>();
  for (const cast of input) {
    if (isApprovedChannel(cast.channel) && !cast.hidden && Number.isFinite(cast.timestamp) && cast.timestamp <= now) {
      unique.set(cast.hash, cast);
    }
  }
  const newest = (a: T, b: T) => b.timestamp - a.timestamp || a.hash.localeCompare(b.hash);
  const latest = [...unique.values()].sort(newest);
  const popular = latest.filter(c => c.timestamp >= now - FEED_POLICY.popularWindowMs)
    .sort((a, b) => scoreCast(b).total - scoreCast(a).total || newest(a, b));
  const seen = new Set<string>();
  const result: { candidate: T; lane: 'popular' | 'latest'; score: ReturnType<typeof scoreCast> }[] = [];
  let pi = 0;
  let li = 0;
  const take = (lane: 'popular' | 'latest') => {
    const list = lane === 'popular' ? popular : latest;
    let index = lane === 'popular' ? pi : li;
    while (index < list.length && seen.has(list[index].hash)) index++;
    const candidate = list[index++];
    if (lane === 'popular') pi = index; else li = index;
    if (candidate) {
      seen.add(candidate.hash);
      result.push({ candidate, lane, score: scoreCast(candidate) });
    }
  };
  while (pi < popular.length || li < latest.length) {
    for (let i = 0; i < FEED_POLICY.popularSlots; i++) take('popular');
    for (let i = 0; i < FEED_POLICY.latestSlots; i++) take('latest');
  }
  return result;
}
