/** Product policy is independent of the upstream client and provider. */
export const APPROVED_CHANNELS = ['cryptoart', 'degen-art', 'gen-art', 'ai-art', 'gifart', 'veg', 'kismet'] as const;
export type ApprovedChannel = (typeof APPROVED_CHANNELS)[number];
export const DEFAULT_CHANNEL: ApprovedChannel = 'cryptoart';
export const MARKETPLACE_ORIGIN = 'https://cryptoart.social';

/** Editorial placements are explicit and reviewable. Chain is part of the ID. */
export const FEATURED_AUCTIONS = [
  { chainId: 1 as const, listingId: '5' },
] as const;

/** Temporary launch examples for validating activity-card presentation. */
export const RECENT_SALE_EXAMPLES = [
  { chainId: 1 as const, listingId: '6' },
] as const;

/** Left-rail cherry picks when live market signal is thin. Explicit, reviewable. */
export const CURATED_RAIL_PICKS = [
  {
    id: 'respiration',
    title: 'Respiration',
    artist: '@mxjxn',
    note: 'On view · auction',
    href: '/listing/eth/5',
    imageUrl: 'https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/2e4643bd5e404271.webp',
    amount: '0.05',
    currency: 'ETH',
  },
  {
    id: 'nearcaster',
    title: 'NEARCASTER',
    artist: '@push-',
    note: 'Recent sale',
    href: '/listing/eth/6',
    imageUrl: 'https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/710855c3883a0a9a.webp',
    amount: '0.02',
    currency: 'ETH',
  },
  {
    id: 'works-in-public',
    title: 'Works in Public',
    artist: 'curated by @mxjxn',
    note: 'Exhibition',
    href: '/exhibitions/works-in-public',
    imageUrl: 'https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/2e4643bd5e404271.webp',
    amount: null,
    currency: null,
  },
] as const;
export const FEED_POLICY = {
  popularWindowMs: 24 * 60 * 60 * 1000,
  // Initial tuning values, deliberately separate from eligibility.
  popularSlots: 2,
  latestSlots: 1,
  likeWeight: 1,
  recastWeight: 2,
  replyWeight: 1,
  activeListingBoost: 8,
  weightedLikes: { 4905: 20 } as Readonly<Record<number, number>>,
};

export function isApprovedChannel(value: unknown): value is ApprovedChannel {
  return typeof value === 'string' && (APPROVED_CHANNELS as readonly string[]).includes(value);
}

export function composerChannel(channel?: string): ApprovedChannel {
  return isApprovedChannel(channel) ? channel : DEFAULT_CHANNEL;
}
