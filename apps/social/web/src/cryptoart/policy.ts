/** Product policy is independent of the upstream client and provider. */
export const APPROVED_CHANNELS = ['cryptoart', 'degen-art', 'gen-art', 'ai-art', 'gifart', 'veg', 'kismet'] as const;
export type ApprovedChannel = (typeof APPROVED_CHANNELS)[number];
export const DEFAULT_CHANNEL: ApprovedChannel = 'cryptoart';
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
