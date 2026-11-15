import { costFromTurboEstimate, METADATA_ALLOWANCE_BYTES, sumUploadCosts, type UploadCost } from './quote';

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

export { METADATA_ALLOWANCE_BYTES };
