import { useEnsAvatar, useEnsName } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { type Address } from 'viem';

/**
 * Hook to resolve ENS avatar for an Ethereum address
 * Only resolves on mainnet (ENS is on mainnet)
 * First resolves the ENS name, then gets the avatar for that name
 * 
 * @param address - The Ethereum address to resolve
 * @param enabled - Whether to enable the query (default: true)
 * @returns The ENS avatar URL if found, undefined otherwise
 */
export function useEnsAvatarForAddress(
  address: Address | string | undefined | null,
  enabled: boolean = true
): string | undefined {
  // First, get the ENS name for the address
  const { data: ensName } = useEnsName({
    address: address as Address | undefined,
    chainId: mainnet.id,
    query: {
      enabled: enabled && !!address,
    },
  });

  // Then, get the avatar for the ENS name
  const { data: ensAvatar } = useEnsAvatar({
    name: ensName || undefined,
    chainId: mainnet.id,
    query: {
      enabled: enabled && !!address && !!ensName,
    },
  });

  return ensAvatar || undefined;
}

