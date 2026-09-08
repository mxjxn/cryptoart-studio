import { describe, expect, it } from 'vitest';
import { rankFeed, scoreCast, type Candidate } from './ranking';
import { composerChannel } from './policy';
import { parseListingUrl, listingReferences } from './listing-links';
import { normalizeCast } from './neynar';

const now = 1800000000000;
const cast = (hash: string, changes: Partial<Candidate> = {}): Candidate => ({ hash, channel: 'cryptoart', timestamp: now - 1000,
  likes: 0, recasts: 0, replies: 0, weightedLikerFids: [], ...changes });

describe('Cryptoart feed policy', () => {
  it('never admits an outside-channel cast even with a curator like', () => {
    expect(rankFeed([cast('a', { channel: 'outside', weightedLikerFids: [4905] })], now)).toEqual([]);
  });
  it('interlaces popular with latest and never repeats a cast', () => {
    const result = rankFeed([cast('old-popular', { likes: 100, timestamp: now - 10000 }),
      cast('second', { likes: 50, timestamp: now - 8000 }), cast('fresh', { timestamp: now }), cast('fourth', { likes: 20 })], now);
    expect(result.map(x => x.candidate.hash)).toEqual(['old-popular', 'second', 'fresh', 'fourth']);
    expect(result.slice(0, 3).map(x => x.lane)).toEqual(['popular', 'popular', 'latest']);
  });
  it('keeps older casts out of the popular lane, even if heavily liked', () => {
    const result = rankFeed([cast('old', { timestamp: now - 86400001, likes: 1000 }), cast('new')], now);
    expect(result.find(x => x.candidate.hash === 'old')?.lane).toBe('latest');
  });
  it('counts a weighted liker once and removes the boost when absent', () => {
    expect(scoreCast(cast('a', { weightedLikerFids: [4905, 4905, 2] })).curation).toBe(20);
    expect(scoreCast(cast('a')).curation).toBe(0);
  });
  it('allows a weighted like to lift a less-popular cast', () => {
    expect(rankFeed([cast('popular', { likes: 100 }), cast('curated', { weightedLikerFids: [4905] })], now)[0].candidate.hash).toBe('curated');
  });
  it('ignores future, invalid, and hidden casts; uses stable ties', () => {
    const result = rankFeed([cast('future', { timestamp: now + 1 }), cast('bad', { timestamp: NaN }), cast('hidden', { hidden: true }), cast('b'), cast('a'), cast('a')], now);
    expect(result.map(x => x.candidate.hash)).toEqual(['a', 'b']);
  });
  it('defaults composition to cryptoart and preserves approved selections', () => {
    expect(composerChannel()).toBe('cryptoart'); expect(composerChannel('outside')).toBe('cryptoart'); expect(composerChannel('veg')).toBe('veg');
  });
});

describe('listing references', () => {
  it('supports both chains, explicit Base paths, legacy queries, and large IDs', () => {
    expect(parseListingUrl('https://cryptoart.social/listing/base/42')?.chainId).toBe(8453);
    expect(parseListingUrl('https://cryptoart.social/listing/42?chainId=1')?.url).toBe('https://cryptoart.social/listing/eth/42');
    expect(parseListingUrl('https://cryptoart.social/listing/eth/9007199254740993123?utm_source=cast')?.listingId).toBe('9007199254740993123');
  });
  it('rejects spoofed hosts and conflicting chain hints', () => {
    expect(parseListingUrl('https://cryptoart.social.evil.com/listing/42')).toBeNull();
    expect(parseListingUrl('https://cryptoart.social/listing/eth/42?chainId=8453')).toBeNull();
    expect(parseListingUrl('https://cryptoart.social/listing/42?chainId=5')).toBeNull();
  });
  it('deduplicates embeds/text but keeps same listing number on different chains', () => {
    expect(listingReferences('https://cryptoart.social/listing/42. https://cryptoart.social/listing/eth/42', ['https://cryptoart.social/listing/42'])).toHaveLength(2);
  });
  it('does not treat a liker sample or listing URL as verified ranking signals', () => {
    const candidate = normalizeCast({ hash: 'a', author: { fid: 1 }, channel: { id: 'cryptoart' },
      timestamp: new Date(now).toISOString(), text: 'https://cryptoart.social/listing/42',
      reactions: { likes: [{ fid: 4905 }] }, viewer_context: { liked: true } });
    expect(candidate.weightedLikerFids).toEqual([]); expect(candidate.activeListing).toBeUndefined();
    expect(candidate.cast.viewerContext).toBeUndefined(); expect(candidate.listings).toHaveLength(1);
  });
  it('renders known pending media as images and resolved web links as previews', () => {
    const candidate = normalizeCast({ hash: 'a', author: { fid: 1 }, timestamp: new Date(now).toISOString(), text: 'art',
      embeds: [{ url: 'https://imagedelivery.net/account/image/original' },
        { url: 'https://example.com/art', metadata: { html: { ogTitle: 'Artwork', ogImage: [{ url: 'https://example.com/art.png' }] } } }] });
    expect(candidate.cast.embeds?.images).toHaveLength(1);
    expect(candidate.cast.embeds?.urls[0].openGraph.title).toBe('Artwork');
    expect(candidate.cast.embeds?.unknowns).toHaveLength(0);
  });
  it('preserves Neynar mini-app metadata for the upstream interactive renderer', () => {
    const candidate = normalizeCast({ hash: 'mini', author: { fid: 1 }, timestamp: new Date(now).toISOString(), text: 'play',
      embeds: [{ url: 'https://app.example/play', metadata: { html: { ogTitle: 'Example', ogSiteName: 'Example App' },
        frame: { version: '1', title: 'Enter', image: 'https://app.example/preview.png', frames_url: 'https://app.example/play' } } }] });
    expect(candidate.cast.embeds?.urls[0].openGraph.frameEmbedNext).toMatchObject({
      frameUrl: 'https://app.example/play', frameEmbed: { imageUrl: 'https://app.example/preview.png',
        button: { title: 'Enter', action: { type: 'launch_miniapp', name: 'Example App' } } },
    });
  });
});
