import { DEFAULT_ARWEAVE_GATEWAY } from '../pin';
import type { ArweaveAdapter } from '../types';
import { buildAudioCoverPlaceholderSvg } from './placeholder';
import { buildAudioNftMetadata } from './metadata';
import { buildAudioPlayerHtml } from './player';

function gatewayFor(id: string, gateways: string[]) {
  const origin = gateways[0] ?? DEFAULT_ARWEAVE_GATEWAY;
  return `${origin.replace(/\/$/, '')}/${id}`;
}

export async function publishAudioPinMetadata(input: {
  arweave: ArweaveAdapter;
  mediaId: string;
  mediaMime: string;
  mediaSha256: string;
  mediaSize: number;
  mediaGateways: string[];
  name: string;
  description?: string;
  artist?: string;
  durationSeconds?: number;
  coverBytes?: Uint8Array;
  coverMime?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}) {
  const audioUri = `ar://${input.mediaId}`;
  const audioUrl = gatewayFor(input.mediaId, input.mediaGateways);

  let imageUri: string;
  if (input.coverBytes?.byteLength) {
    const uploaded = await input.arweave.upload({
      bytes: input.coverBytes,
      mimeType: input.coverMime || 'image/png',
      tags: { 'Content-Type': input.coverMime || 'image/png', Kind: 'audio-cover' },
    });
    imageUri = `ar://${uploaded.id}`;
  } else {
    const svg = new TextEncoder().encode(buildAudioCoverPlaceholderSvg(input.name, input.artist));
    const uploaded = await input.arweave.upload({
      bytes: svg,
      mimeType: 'image/svg+xml',
      tags: { 'Content-Type': 'image/svg+xml', Kind: 'audio-cover-placeholder' },
    });
    imageUri = `ar://${uploaded.id}`;
  }

  const coverUrl = imageUri.startsWith('ar://') ? gatewayFor(imageUri.slice(5), input.mediaGateways) : imageUri;
  const playerHtml = buildAudioPlayerHtml({
    title: input.name,
    artist: input.artist,
    audioUrl,
    coverUrl,
  });
  const playerBytes = new TextEncoder().encode(playerHtml);
  const playerUploaded = await input.arweave.upload({
    bytes: playerBytes,
    mimeType: 'text/html',
    tags: { 'Content-Type': 'text/html', Kind: 'audio-player' },
  });
  const playerUri = `ar://${playerUploaded.id}`;

  const metadata = buildAudioNftMetadata({
    name: input.name,
    description: input.description,
    artist: input.artist,
    audioUri,
    audioMime: input.mediaMime,
    audioSha256: input.mediaSha256,
    audioSize: input.mediaSize,
    playerUri,
    imageUri,
    durationSeconds: input.durationSeconds,
    attributes: input.attributes,
  });
  const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));

  return {
    metadata,
    metadataBytes,
    playerId: playerUploaded.id,
    metadataObject: metadata,
  };
}

export function decodeBase64Bytes(value: unknown): Uint8Array | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return new Uint8Array(Buffer.from(value, 'base64'));
}
