import { DEFAULT_ARWEAVE_GATEWAY } from '../pin';
import type { ArweaveAdapter } from '../types';
import { modelExtensionFromName } from './mime';
import { buildModelCoverPlaceholderSvg } from './placeholder';
import { buildModelNftMetadata } from './metadata';
import { buildModelViewerHtml } from './viewer';
import { viewerEngineForFileName } from './validate';

function gatewayFor(id: string, gateways: string[]) {
  const origin = gateways[0] ?? DEFAULT_ARWEAVE_GATEWAY;
  return `${origin.replace(/\/$/, '')}/${id}`;
}

export async function publishModelPinMetadata(input: {
  arweave: ArweaveAdapter;
  mediaId: string;
  mediaMime: string;
  mediaSha256: string;
  mediaSize: number;
  mediaFileName: string;
  mediaGateways: string[];
  name: string;
  description?: string;
  creator?: string;
  coverBytes?: Uint8Array;
  coverMime?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}) {
  const modelUri = `ar://${input.mediaId}`;
  const modelUrl = gatewayFor(input.mediaId, input.mediaGateways);
  const format = modelExtensionFromName(input.mediaFileName) ?? 'glb';
  const engine = viewerEngineForFileName(input.mediaFileName);

  let imageUri: string;
  if (input.coverBytes?.byteLength) {
    const uploaded = await input.arweave.upload({
      bytes: input.coverBytes,
      mimeType: input.coverMime || 'image/png',
      tags: { 'Content-Type': input.coverMime || 'image/png', Kind: 'model-cover' },
    });
    imageUri = `ar://${uploaded.id}`;
  } else {
    const svg = new TextEncoder().encode(buildModelCoverPlaceholderSvg(input.name, input.creator));
    const uploaded = await input.arweave.upload({
      bytes: svg,
      mimeType: 'image/svg+xml',
      tags: { 'Content-Type': 'image/svg+xml', Kind: 'model-cover-placeholder' },
    });
    imageUri = `ar://${uploaded.id}`;
  }

  const posterUrl = imageUri.startsWith('ar://') ? gatewayFor(imageUri.slice(5), input.mediaGateways) : imageUri;
  const viewerHtml = buildModelViewerHtml({
    title: input.name,
    creator: input.creator,
    modelUrl,
    posterUrl,
    format,
    engine,
  });
  const viewerBytes = new TextEncoder().encode(viewerHtml);
  const viewerUploaded = await input.arweave.upload({
    bytes: viewerBytes,
    mimeType: 'text/html',
    tags: { 'Content-Type': 'text/html', Kind: 'model-viewer' },
  });
  const viewerUri = `ar://${viewerUploaded.id}`;

  const metadata = buildModelNftMetadata({
    name: input.name,
    description: input.description,
    creator: input.creator,
    modelUri,
    modelMime: input.mediaMime,
    modelSha256: input.mediaSha256,
    modelSize: input.mediaSize,
    modelFormat: format,
    viewerUri,
    imageUri,
    attributes: input.attributes,
  });
  const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));

  return {
    metadata,
    metadataBytes,
    viewerId: viewerUploaded.id,
    metadataObject: metadata,
  };
}