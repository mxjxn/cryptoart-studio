import type { TurboX402NetworkName } from './turboX402Network';

export type { TurboX402NetworkName };
export { turboX402NetworkFromEip155, defaultEip155Network } from './turboX402Network';

export type TurboX402PriceClient = {
  getX402PriceForRawData(input: {
    byteCount: number;
    network?: string;
    tagCount?: number;
    contentType?: string;
  }): Promise<{ usdcAmount: string }>;
};

export async function defaultTurboX402PriceClient(uploadServiceUrl?: string): Promise<TurboX402PriceClient> {
  const loaded = await import('@ardrive/turbo-sdk').catch(() => null) as {
    TurboFactory?: {
      unauthenticated: (config?: { token?: string; uploadServiceConfig?: { url?: string } }) => TurboX402PriceClient;
    };
  } | null;
  if (!loaded?.TurboFactory) throw new Error('Turbo price quote failed: install @ardrive/turbo-sdk');
  return loaded.TurboFactory.unauthenticated({
    token: 'base-usdc',
    ...(uploadServiceUrl ? { uploadServiceConfig: { url: uploadServiceUrl } } : {}),
  });
}