import type { UploadCost } from '../quote';
import { quoteTurboUploadCost, quoteTurboBundle, type UploadCostSource } from '../turboCost';

export const AUDIO_PLAYER_ALLOWANCE_BYTES = 14_000;
export const AUDIO_COVER_PLACEHOLDER_BYTES = 2_500;

export type AudioNftMetadata = {
  name: string;
  description?: string;
  image: string;
  animation_url: string;
  cryptoart: {
    mediaType: 'audio';
    playerVersion: 1;
  };
  properties: {
    category: 'audio';
    files: Array<{
      uri: string;
      type: string;
      size?: number;
    }>;
    duration?: number;
    artist?: string;
  };
  attributes?: Array<{ trait_type: string; value: string | number }>;
};

export function buildAudioNftMetadata(input: {
  name: string;
  description?: string;
  artist?: string;
  audioUri: string;
  audioMime: string;
  audioSha256: string;
  audioSize: number;
  playerUri: string;
  imageUri: string;
  durationSeconds?: number;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}): AudioNftMetadata {
  const metadata: AudioNftMetadata = {
    name: input.name,
    image: input.imageUri,
    animation_url: input.playerUri,
    cryptoart: { mediaType: 'audio', playerVersion: 1 },
    properties: {
      category: 'audio',
      files: [{ uri: input.audioUri, type: input.audioMime, size: input.audioSize }],
    },
  };
  if (input.description) metadata.description = input.description;
  if (input.artist) metadata.properties.artist = input.artist;
  if (typeof input.durationSeconds === 'number' && Number.isFinite(input.durationSeconds) && input.durationSeconds > 0) {
    metadata.properties.duration = input.durationSeconds;
  }
  const attributes = [...(input.attributes ?? [])];
  if (input.artist) attributes.push({ trait_type: 'Artist', value: input.artist });
  if (attributes.length) metadata.attributes = attributes;
  return metadata;
}

/** Price audio, an optional cover, a generated player page, and the metadata JSON allowance. */
export async function quoteAudioPinBundle(
  audioBytes: number,
  coverBytes = 0,
  source: UploadCostSource = quoteTurboUploadCost,
): Promise<UploadCost> {
  const cover = coverBytes > 0 ? coverBytes : AUDIO_COVER_PLACEHOLDER_BYTES;
  const [audio, artwork, player, meta] = await Promise.all([
    source(audioBytes),
    source(cover),
    source(AUDIO_PLAYER_ALLOWANCE_BYTES),
    quoteTurboBundle(4096, source),
  ]);
  return {
    winston: (BigInt(audio.winston) + BigInt(artwork.winston) + BigInt(player.winston) + BigInt(meta.winston)).toString(),
    usd: Number((audio.usd + artwork.usd + player.usd + meta.usd).toFixed(6)),
    source: 'turbo',
  };
}