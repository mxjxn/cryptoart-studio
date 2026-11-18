import { describe, expect, it } from 'vitest';
import { buildAudioNftMetadata, quoteAudioPinBundle } from './metadata';
import { buildAudioPlayerHtml } from './player';
import { detectNftMediaType, audioSourceFromMetadata } from './detect';
import { isAudioMimeType, guessAudioMimeType } from './mime';

describe('audio mime helpers', () => {
  it('detects common upload types', () => {
    expect(isAudioMimeType('audio/mpeg')).toBe(true);
    expect(isAudioMimeType('audio/flac')).toBe(true);
    expect(guessAudioMimeType('track.mp3', 'application/octet-stream')).toBe('audio/mpeg');
    expect(isAudioMimeType('image/png')).toBe(false);
  });
});

describe('audio NFT metadata', () => {
  it('sets image, animation_url, cryptoart.mediaType, and properties.files', () => {
    const metadata = buildAudioNftMetadata({
      name: 'Midnight Loop',
      artist: 'Anon',
      audioUri: 'ar://audio-tx',
      audioMime: 'audio/mpeg',
      audioSha256: 'abc',
      audioSize: 4_000_000,
      playerUri: 'ar://player-tx',
      imageUri: 'ar://cover-tx',
      durationSeconds: 182,
    });
    expect(metadata.image).toBe('ar://cover-tx');
    expect(metadata.animation_url).toBe('ar://player-tx');
    expect(metadata.cryptoart.mediaType).toBe('audio');
    expect(metadata.properties.category).toBe('audio');
    expect(metadata.properties.files[0]).toEqual({
      uri: 'ar://audio-tx',
      type: 'audio/mpeg',
      size: 4_000_000,
    });
    expect(metadata.properties.duration).toBe(182);
  });

  it('prices the audio file, player page, cover placeholder, and metadata JSON', async () => {
    const seen: number[] = [];
    await quoteAudioPinBundle(2_000_000, 0, async (bytes) => {
      seen.push(bytes);
      return { winston: String(bytes), usd: bytes / 1_000_000, source: 'turbo' };
    });
    expect(seen).toContain(2_000_000);
    expect(seen.filter((value) => value > 10_000).length).toBeGreaterThan(0);
  });
});

describe('audio player html', () => {
  it('embeds title, artist, and audio URL without branding', () => {
    const html = buildAudioPlayerHtml({
      title: 'Signal',
      artist: 'mxjxn',
      audioUrl: 'https://arweave.net/audio',
    });
    expect(html).toContain('Signal');
    expect(html).toContain('mxjxn');
    expect(html).toContain('https://arweave.net/audio');
    expect(html).not.toMatch(/cryptoart/i);
  });
});

describe('detectNftMediaType', () => {
  it('reads cryptoart.mediaType and external properties.files conventions', () => {
    expect(detectNftMediaType({ cryptoart: { mediaType: 'audio' } })).toBe('audio');
    expect(detectNftMediaType({
      properties: { category: 'audio', files: [{ uri: 'ar://a', type: 'audio/wav' }] },
      image: 'ar://cover',
      animation_url: 'ar://player.html',
    })).toBe('audio');
    expect(audioSourceFromMetadata({
      properties: { files: [{ uri: 'ar://track', type: 'audio/mpeg' }] },
    })).toBe('ar://track');
  });
});