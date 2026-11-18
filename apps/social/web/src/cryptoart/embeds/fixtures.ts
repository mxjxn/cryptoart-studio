import type { CastCard } from '../neynar';
import type { DeskCastEmbeds } from './types';

const baseEmbed: DeskCastEmbeds = {
  images: [],
  urls: [],
  unknowns: [],
};

export const embedFixtureCasts: Record<string, CastCard> = {
  listing: {
    hash: 'fixture-listing', threadHash: 'fixture-listing', author: { fid: 1, displayName: 'Fixture' },
    text: 'New listing on Cryptoart', timestamp: Date.now(), mentions: [],
    reactions: { count: 0 }, recasts: { count: 0 }, replies: { count: 0 }, watches: { count: 0 },
    embeds: {
      ...baseEmbed,
      unknowns: [{ type: 'unknown', source: 'https://cryptoart.social/listing/base/42?referralAddress=0xabc' }],
    },
  },
  token: {
    hash: 'fixture-token', threadHash: 'fixture-token', author: { fid: 1, displayName: 'Fixture' },
    text: 'chain://eip155:1/erc721:0xcc3cac6d9f77681cbff754377ad4599f5d8afd30/37', timestamp: Date.now(), mentions: [],
    reactions: { count: 0 }, recasts: { count: 0 }, replies: { count: 0 }, watches: { count: 0 },
    embeds: baseEmbed,
  },
  frame: {
    hash: 'fixture-frame', threadHash: 'fixture-frame', author: { fid: 1, displayName: 'Fixture' },
    text: 'Try this mini app', timestamp: Date.now(), mentions: [],
    reactions: { count: 0 }, recasts: { count: 0 }, replies: { count: 0 }, watches: { count: 0 },
    embeds: {
      ...baseEmbed,
      urls: [{
        type: 'url',
        openGraph: {
          url: 'https://app.example/play',
          sourceUrl: 'https://app.example/play',
          title: 'Example',
          frameEmbedNext: {
            frameUrl: 'https://app.example/play',
            frameEmbed: {
              version: '1',
              imageUrl: 'https://app.example/preview.png',
              button: { title: 'Open', action: { type: 'launch_miniapp', name: 'Example App', url: 'https://app.example/play' } },
            },
          },
        },
      }],
    },
  },
  quote: {
    hash: 'fixture-quote', threadHash: 'fixture-quote', author: { fid: 1, displayName: 'Fixture' },
    text: 'Well said', timestamp: Date.now(), mentions: [],
    reactions: { count: 0 }, recasts: { count: 0 }, replies: { count: 0 }, watches: { count: 0 },
    embeds: {
      ...baseEmbed,
      quotes: [{ hash: '0xdeadbeef', text: 'Art is the argument.', author: { username: 'dwr', displayName: 'Dan' } }],
    },
  },
  video: {
    hash: 'fixture-video', threadHash: 'fixture-video', author: { fid: 1, displayName: 'Fixture' },
    text: '', timestamp: Date.now(), mentions: [],
    reactions: { count: 0 }, recasts: { count: 0 }, replies: { count: 0 }, watches: { count: 0 },
    embeds: {
      ...baseEmbed,
      videos: [{ url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', sourceUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' }],
    },
  },
  image: {
    hash: 'fixture-image', threadHash: 'fixture-image', author: { fid: 1, displayName: 'Fixture' },
    text: '', timestamp: Date.now(), mentions: [],
    reactions: { count: 0 }, recasts: { count: 0 }, replies: { count: 0 }, watches: { count: 0 },
    embeds: {
      ...baseEmbed,
      images: [{ type: 'image', url: 'https://i.imgur.com/2T5DaQT.jpg', sourceUrl: 'https://i.imgur.com/2T5DaQT.jpg', alt: 'Sample' }],
    },
  },
  og: {
    hash: 'fixture-og', threadHash: 'fixture-og', author: { fid: 1, displayName: 'Fixture' },
    text: '', timestamp: Date.now(), mentions: [],
    reactions: { count: 0 }, recasts: { count: 0 }, replies: { count: 0 }, watches: { count: 0 },
    embeds: {
      ...baseEmbed,
      urls: [{
        type: 'url',
        openGraph: {
          url: 'https://example.com/art',
          sourceUrl: 'https://example.com/art',
          title: 'Artwork preview',
          description: 'Open-graph listing for desk',
          image: 'https://i.imgur.com/2T5DaQT.jpg',
        },
      }],
    },
  },
  plain: {
    hash: 'fixture-plain', threadHash: 'fixture-plain', author: { fid: 1, displayName: 'Fixture' },
    text: 'https://example.org/deck', timestamp: Date.now(), mentions: [],
    reactions: { count: 0 }, recasts: { count: 0 }, replies: { count: 0 }, watches: { count: 0 },
    embeds: { ...baseEmbed, unknowns: [{ type: 'unknown', source: 'https://example.org/deck' }] },
  },
  stub: {
    hash: 'fixture-stub', threadHash: 'fixture-stub', author: { fid: 1, displayName: 'Fixture' },
    text: 'https://cryptoart.studio/gallery/demo', timestamp: Date.now(), mentions: [],
    reactions: { count: 0 }, recasts: { count: 0 }, replies: { count: 0 }, watches: { count: 0 },
    embeds: baseEmbed,
  },
};