import { fallback, http, type AddEthereumChainParameter, type Transport } from "viem";
import { base, mainnet } from "viem/chains";

/**
 * Public Ethereum RPC endpoints used when `NEXT_PUBLIC_MAINNET_RPC_URL` is
 * unset or the primary host is down. LlamaRPC (previous sole fallback) has
 * been returning 521s, which broke `getListing` reads and bid simulation on
 * `/listing/eth/…` pages.
 */
const MAINNET_RPC_FALLBACKS = [
  "https://ethereum-rpc.publicnode.com",
  "https://cloudflare-eth.com",
  "https://eth.llamarpc.com",
] as const;

export function uniqueRpcUrls(urls: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function mainnetRpcUrls(): string[] {
  return uniqueRpcUrls([
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
    ...MAINNET_RPC_FALLBACKS,
  ]);
}

export function mainnetRpcUrl(): string {
  return mainnetRpcUrls()[0];
}

export function mainnetTransport(): Transport {
  const urls = mainnetRpcUrls();
  if (urls.length === 1) return http(urls[0]);
  return fallback(urls.map((url) => http(url)));
}

/**
 * EIP-3085 params for `wallet_addEthereumChain`. Wallets that cannot switch
 * to a chain they have never seen (error 4902) need the dapp to add it.
 */
export function addEthereumChainParameterFor(
  chainId: number
): AddEthereumChainParameter | undefined {
  const chain = chainId === mainnet.id ? mainnet : chainId === base.id ? base : undefined;
  if (!chain) return undefined;

  const rpcUrls =
    chain.id === mainnet.id
      ? mainnetRpcUrls()
      : [...(chain.rpcUrls.default.http ?? [])];

  return {
    chainId: `0x${chain.id.toString(16)}`,
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls,
    blockExplorerUrls: chain.blockExplorers
      ? [chain.blockExplorers.default.url]
      : undefined,
  };
}
