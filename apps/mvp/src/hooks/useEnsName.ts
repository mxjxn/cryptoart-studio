import { useEnsName } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { type Address } from 'viem';

/**
 * Hook to resolve ENS name for an Ethereum address
 * Only resolves on mainnet (ENS is on mainnet)
 * 
 * @param address - The Ethereum address to resolve
 * @param enabled - Whether to enable the query (default: true)
 * @returns The ENS name if found, undefined otherwise
 */
export function useEnsNameForAddress(
  address: Address | string | undefined | null,
  enabled: boolean = true
): string | undefined {
  // Avoid hammering default public RPCs (llamarpc) unless a dedicated
  // mainnet RPC is configured for the client.
  const hasConfiguredMainnetRpc = Boolean(process.env.NEXT_PUBLIC_MAINNET_RPC_URL);
  const { data: ensName } = useEnsName({
    address: address as Address | undefined,
    chainId: mainnet.id,
    query: {
      enabled: enabled && !!address && hasConfiguredMainnetRpc,
    },
  });

  return ensName || undefined;
}










