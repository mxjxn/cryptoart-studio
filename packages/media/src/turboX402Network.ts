import { BASE_NETWORK, BASE_SEPOLIA_NETWORK } from './networks';

/** x402 network name for Turbo's upload service (not eip155:…). */
export type TurboX402NetworkName = 'base' | 'base-sepolia';

export function turboX402NetworkFromEip155(network: string): TurboX402NetworkName {
  if (network === BASE_NETWORK) return 'base';
  if (network === BASE_SEPOLIA_NETWORK) return 'base-sepolia';
  throw new Error(`Unsupported media network for Turbo x402: ${network}`);
}

export function defaultEip155Network(isProd: boolean) {
  return isProd ? BASE_NETWORK : BASE_SEPOLIA_NETWORK;
}