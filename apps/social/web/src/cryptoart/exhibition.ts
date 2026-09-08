import type { SocialCandidate } from './neynar';
import type { scoreCast } from './ranking';

export type RankedSocialItem = {
  candidate: SocialCandidate;
  lane: 'popular' | 'latest';
  score: ReturnType<typeof scoreCast>;
};

export type Exhibition = {
  selected: RankedSocialItem[];
  miniApps: RankedSocialItem[];
  arrivals: RankedSocialItem[];
  conversations: RankedSocialItem[];
  remainder: RankedSocialItem[];
};

const hasImage = (item: RankedSocialItem) => (item.candidate.cast.embeds?.images?.length ?? 0) > 0;
const hasMiniApp = (item: RankedSocialItem) => item.candidate.cast.embeds?.urls?.some(
  embed => Boolean(embed.openGraph.frameEmbedNext?.frameEmbed),
) ?? false;

/** Compose ranked items into a paced exhibition without changing their ranking. */
export function composeExhibition(items: RankedSocialItem[]): Exhibition {
  const used = new Set<string>();
  const take = (predicate: (item: RankedSocialItem) => boolean, limit: number) => items
    .filter(item => !used.has(item.candidate.hash) && predicate(item))
    .slice(0, limit)
    .map(item => { used.add(item.candidate.hash); return item; });

  const miniApps = take(hasMiniApp, 3);
  const selected = take(item => hasImage(item) && item.score.curation > 0, 2);
  if (selected.length < 2) {
    selected.push(...take(item => hasImage(item) && item.lane === 'popular', 2 - selected.length));
  }
  const arrivals = take(hasImage, 6);
  const conversations = take(item => !hasImage(item), 2);
  const remainder = items.filter(item => !used.has(item.candidate.hash));
  return { selected, miniApps, arrivals, conversations, remainder };
}
