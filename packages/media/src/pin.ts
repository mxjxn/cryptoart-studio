import type { UploadJob } from './types';

export const DEFAULT_ARWEAVE_GATEWAY = 'https://arweave.net';

export type PinnedMedia = {
  /** Artwork bytes. Present once Turbo (or the configured uploader) returns an id. */
  mediaUri: string;
  /** Token URI for the mint transaction. Null until metadata JSON is pinned. */
  metadataUri: string | null;
  mediaGatewayUrl: string;
  metadataGatewayUrl: string | null;
  /** Gateway URL Track A should show. Metadata once it exists, otherwise the artwork. */
  gatewayUrl: string;
  /** True only when both pins were retrieved from a gateway. */
  mintEnabled: boolean;
};

function gatewayUrl(origin: string, id: string) {
  return `${origin.replace(/\/$/, '')}/${id}`;
}

/**
 * What the mint flow should read after a paid pin.
 * Use `metadataUri` as the on-chain token URI when `mintEnabled` is true.
 * `mediaUri` is the artwork inside that metadata JSON, not the token URI.
 */
export function pinnedMediaForMint(job: UploadJob): PinnedMedia | null {
  if (!job.media?.id) return null;
  const mediaOrigin = job.media.gateways[0] ?? DEFAULT_ARWEAVE_GATEWAY;
  const metadataOrigin = job.metadata?.gateways[0] ?? mediaOrigin;
  const metadataUri = job.metadata?.id ? `ar://${job.metadata.id}` : null;
  const mediaGatewayUrl = gatewayUrl(mediaOrigin, job.media.id);
  const metadataGatewayUrl = job.metadata?.id ? gatewayUrl(metadataOrigin, job.metadata.id) : null;
  return {
    mediaUri: `ar://${job.media.id}`,
    metadataUri,
    mediaGatewayUrl,
    metadataGatewayUrl,
    gatewayUrl: metadataGatewayUrl ?? mediaGatewayUrl,
    mintEnabled: job.status === 'confirmed' && Boolean(job.metadata?.id),
  };
}
