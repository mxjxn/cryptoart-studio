import type { UploadCost } from '../quote';
import { quoteTurboUploadCost, quoteTurboBundle, type UploadCostSource } from '../turboCost';

export const MODEL_VIEWER_ALLOWANCE_BYTES = 24_000;
export const MODEL_COVER_PLACEHOLDER_BYTES = 2_800;

export type ModelNftMetadata = {
  name: string;
  description?: string;
  image: string;
  animation_url: string;
  cryptoart: {
    mediaType: 'model';
    viewerVersion: 1;
    format: string;
  };
  properties: {
    category: 'model';
    files: Array<{
      uri: string;
      type: string;
      size?: number;
    }>;
    creator?: string;
  };
  attributes?: Array<{ trait_type: string; value: string | number }>;
};

export function buildModelNftMetadata(input: {
  name: string;
  description?: string;
  creator?: string;
  modelUri: string;
  modelMime: string;
  modelSha256: string;
  modelSize: number;
  modelFormat: string;
  viewerUri: string;
  imageUri: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}): ModelNftMetadata {
  const metadata: ModelNftMetadata = {
    name: input.name,
    image: input.imageUri,
    animation_url: input.viewerUri,
    cryptoart: { mediaType: 'model', viewerVersion: 1, format: input.modelFormat },
    properties: {
      category: 'model',
      files: [{ uri: input.modelUri, type: input.modelMime, size: input.modelSize }],
    },
  };
  if (input.description) metadata.description = input.description;
  if (input.creator) metadata.properties.creator = input.creator;
  const attributes = [...(input.attributes ?? [])];
  if (input.creator) attributes.push({ trait_type: 'Creator', value: input.creator });
  if (attributes.length) metadata.attributes = attributes;
  return metadata;
}

export async function quoteModelPinBundle(
  modelBytes: number,
  coverBytes = 0,
  source: UploadCostSource = quoteTurboUploadCost,
): Promise<UploadCost> {
  const cover = coverBytes > 0 ? coverBytes : MODEL_COVER_PLACEHOLDER_BYTES;
  const [model, artwork, viewer, meta] = await Promise.all([
    source(modelBytes),
    source(cover),
    source(MODEL_VIEWER_ALLOWANCE_BYTES),
    quoteTurboBundle(4096, source),
  ]);
  return {
    winston: (BigInt(model.winston) + BigInt(artwork.winston) + BigInt(viewer.winston) + BigInt(meta.winston)).toString(),
    usd: Number((model.usd + artwork.usd + viewer.usd + meta.usd).toFixed(6)),
    source: 'turbo',
  };
}