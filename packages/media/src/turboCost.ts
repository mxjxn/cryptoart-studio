import { costFromTurboEstimate, METADATA_ALLOWANCE_BYTES, sumUploadCosts, sumUsdcAtomic, type UploadCost } from './quote';
import { defaultTurboX402PriceClient, type TurboX402NetworkName, type TurboX402PriceClient } from './turboX402';

export type TurboFiatClient = {
  getFiatEstimateForBytes(input: { byteCount: number; currency: 'usd' }): Promise<{ amount: number; winc: string }>;
};

export type UploadCostSource = (byteCount: number) => Promise<UploadCost>;

async function defaultTurboClient(): Promise<TurboFiatClient> {
  const loaded = await import('@ardrive/turbo-sdk').catch(() => null) as {
    TurboFactory?: { unauthenticated: () => TurboFiatClient };
  } | null;
  if (!loaded?.TurboFactory) throw new Error('Turbo price quote failed: install @ardrive/turbo-sdk');
  return loaded.TurboFactory.unauthenticated();
}

/**
 * Live USD + winston price for one data item, from Turbo's unauthenticated
 * payment service (`getFiatEstimateForBytes`). There is no local AR/USD constant.
 */
export async function quoteTurboUploadCost(byteCount: number, client?: TurboFiatClient): Promise<UploadCost> {
  if (!Number.isInteger(byteCount) || byteCount <= 0) throw new Error('Byte count must be a positive integer');
  try {
    const turbo = client ?? await defaultTurboClient();
    const estimate = await turbo.getFiatEstimateForBytes({ byteCount, currency: 'usd' });
    return costFromTurboEstimate(estimate);
  } catch (error) {
    if (error instanceof Error && /turbo/i.test(error.message)) throw error;
    throw new Error('Turbo price quote failed');
  }
}

/** Price the artwork bytes and a second small data item for the metadata JSON. */
export async function quoteTurboBundle(fileBytes: number, source: UploadCostSource = quoteTurboUploadCost): Promise<UploadCost> {
  if (!Number.isInteger(fileBytes) || fileBytes <= 0) throw new Error('Each file needs a positive size');
  const [media, metadata] = await Promise.all([
    source(fileBytes),
    source(METADATA_ALLOWANCE_BYTES),
  ]);
  return sumUploadCosts([media, metadata]);
}

export type TurboX402Quote = UploadCost & {
  usdcAmount: string;
  mediaUsdcAmount: string;
  metadataUsdcAmount: string;
};

/** Live Turbo x402 prices for the artwork file and metadata JSON allowance. */
export async function quoteTurboX402Bundle(input: {
  fileBytes: number;
  mimeType: string;
  network: TurboX402NetworkName;
  client?: TurboX402PriceClient;
  uploadServiceUrl?: string;
}): Promise<TurboX402Quote> {
  if (!Number.isInteger(input.fileBytes) || input.fileBytes <= 0) throw new Error('Each file needs a positive size');
  const turbo = input.client ?? await defaultTurboX402PriceClient(input.uploadServiceUrl);
  const mediaTagCount = 2;
  const metadataTagCount = 1;
  const [mediaPrice, metadataPrice] = await Promise.all([
    turbo.getX402PriceForRawData({
      byteCount: input.fileBytes,
      network: input.network,
      tagCount: mediaTagCount,
      contentType: input.mimeType || 'application/octet-stream',
    }),
    turbo.getX402PriceForRawData({
      byteCount: METADATA_ALLOWANCE_BYTES,
      network: input.network,
      tagCount: metadataTagCount,
      contentType: 'application/json',
    }),
  ]);
  const mediaUsdcAmount = mediaPrice.usdcAmount;
  const metadataUsdcAmount = metadataPrice.usdcAmount;
  const usdcAmount = sumUsdcAtomic([mediaUsdcAmount, metadataUsdcAmount]);
  const usd = Number(BigInt(usdcAmount)) / 1_000_000;
  return {
    winston: '0',
    usd,
    source: 'turbo',
    usdcAmount,
    mediaUsdcAmount,
    metadataUsdcAmount,
  };
}

export { METADATA_ALLOWANCE_BYTES };
