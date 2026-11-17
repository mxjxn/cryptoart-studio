'use client';

import { useQuery } from '@tanstack/react-query';

export function useMarketplaceAddress(chainId: number | null | undefined) {
  return useQuery({
    queryKey: ['marketplace-address', chainId],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace?chainId=${chainId}`);
      const body = (await res.json()) as { address?: string; error?: string };
      if (!res.ok || !body.address) throw new Error(body.error || 'Marketplace address is not configured');
      return body.address as `0x${string}`;
    },
    enabled: typeof chainId === 'number' && chainId > 0,
    retry: false,
  });
}