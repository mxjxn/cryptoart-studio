import { describe, expect, it } from 'vitest';
import { classifyCastEmbeds } from './classify';
import { embedFixtureCasts } from './fixtures';
import type { CastCard } from '../neynar';

function cast(overrides: Partial<CastCard> & Pick<CastCard, 'hash'>): CastCard {
  return {
    threadHash: overrides.hash,
    author: { fid: 1, displayName: 'Test' },
    text: '',
    timestamp: Date.now(),
    mentions: [],
    reactions: { count: 0 },
    recasts: { count: 0 },
    replies: { count: 0 },
    watches: { count: 0 },
    embeds: { images: [], urls: [], unknowns: [] },
    ...overrides,
  };
}

describe('classifyCastEmbeds', () => {
  it('classifies cryptoart listing URLs first', () => {
    expect(classifyCastEmbeds(embedFixtureCasts.listing)[0]?.kind).toBe('cryptoart-listing');
  });
  it('classifies chain token URIs', () => {
    expect(classifyCastEmbeds(embedFixtureCasts.token)[0]?.kind).toBe('nft-token');
  });
  it('classifies frame mini-apps', () => {
    expect(classifyCastEmbeds(embedFixtureCasts.frame)[0]?.kind).toBe('frame');
  });
  it('classifies quote casts', () => {
    expect(classifyCastEmbeds(embedFixtureCasts.quote)[0]?.kind).toBe('quote');
  });
  it('classifies video embeds', () => {
    expect(classifyCastEmbeds(embedFixtureCasts.video)[0]?.kind).toBe('video');
  });
  it('classifies images', () => {
    expect(classifyCastEmbeds(embedFixtureCasts.image)[0]?.kind).toBe('image');
  });
  it('classifies open-graph previews', () => {
    expect(classifyCastEmbeds(embedFixtureCasts.og)[0]?.kind).toBe('open-graph');
  });
  it('classifies plain links', () => {
    expect(classifyCastEmbeds(embedFixtureCasts.plain)[0]?.kind).toBe('plain-link');
  });
  it('classifies future gallery embeds as stubs', () => {
    expect(classifyCastEmbeds(embedFixtureCasts.stub)[0]?.kind).toBe('stub-gallery');
  });
  it('orders listing before open-graph on the same cast', () => {
    const mixed = cast({
      hash: 'mixed',
      embeds: {
        images: [],
        unknowns: [{ type: 'unknown', source: 'https://cryptoart.social/listing/base/9' }],
        urls: [{
          type: 'url',
          openGraph: { url: 'https://example.com', sourceUrl: 'https://example.com', title: 'Example' },
        }],
      },
    });
    expect(classifyCastEmbeds(mixed).map(item => item.kind)).toEqual(['cryptoart-listing', 'open-graph']);
  });
});