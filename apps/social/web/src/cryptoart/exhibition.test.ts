import { describe, expect, it } from 'vitest';
import { composeExhibition, type RankedSocialItem } from './exhibition';

const item = (hash: string, image: boolean, curation = 0): RankedSocialItem => ({
  candidate: { hash, channel: 'cryptoart', timestamp: 1, likes: 0, recasts: 0, replies: 0,
    weightedLikerFids: [], listings: [], cast: { hash, threadHash: hash, author: { fid: 1, displayName: hash,
      profile: { bio: { text: '', mentions: [] } }, followerCount: 0, followingCount: 0 }, text: hash,
      timestamp: 1, mentions: [], reactions: { count: 0 }, recasts: { count: 0 }, replies: { count: 0 },
      watches: { count: 0 }, embeds: { images: image ? [{ type: 'image', url: `${hash}.jpg`, sourceUrl: `${hash}.jpg`, alt: '' }] : [], urls: [], unknowns: [] } } },
  lane: 'popular', score: { total: curation, engagement: 0, curation, listing: 0 },
});

describe('exhibition composition', () => {
  it('reserves large placements for curated image casts and never repeats work', () => {
    const result = composeExhibition([item('selected', true, 10), item('new', true), item('talk', false), item('more', false)]);
    expect(result.selected.map(x => x.candidate.hash)).toEqual(['selected', 'new']);
    expect(result.arrivals.map(x => x.candidate.hash)).toEqual([]);
    expect(result.conversations.map(x => x.candidate.hash)).toEqual(['talk', 'more']);
    expect([...result.selected, ...result.miniApps, ...result.arrivals, ...result.conversations, ...result.remainder]).toHaveLength(4);
  });

  it('fills open selection space from popular image casts without displacing curator picks', () => {
    const result = composeExhibition([item('popular-a', true), item('curated', true, 10), item('popular-b', true)]);
    expect(result.selected.map(x => x.candidate.hash)).toEqual(['curated', 'popular-a']);
  });

  it('reserves mini apps for an interactive section', () => {
    const mini = item('mini', false);
    mini.candidate.cast.embeds!.urls = [{ type: 'url', openGraph: { url: 'https://example.com',
      frameEmbedNext: { frameUrl: 'https://example.com', frameEmbed: { version: '1', imageUrl: 'preview.jpg',
        button: { title: 'Open', action: { type: 'launch_miniapp', name: 'Example' } } } } } }];
    const result = composeExhibition([mini, item('talk', false)]);
    expect(result.miniApps.map(x => x.candidate.hash)).toEqual(['mini']);
    expect(result.conversations.map(x => x.candidate.hash)).toEqual(['talk']);
  });
});
