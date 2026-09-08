import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type SessionPayload = {
  address: string;
  chainId: number;
  fid: number | null;
  grants: Array<{ role: string; capability: string; scope: Record<string, unknown> | null }>;
  capabilities: { owner: boolean; roles: boolean; publish: boolean; submit: boolean };
};

async function parse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || 'Request failed');
  return body;
}

export function useSiweSession() {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ['cryptoart-session'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/cryptoart/session', { signal, credentials: 'include' });
      if (response.status === 401) return null;
      return await parse(response) as SessionPayload;
    },
    staleTime: 30_000,
    retry: false,
  });
  const verify = useMutation({
    mutationFn: async (input: { address: string; chainId: number; sign: (message: string) => Promise<`0x${string}`> }) => {
      const nonce = await parse(await fetch('/api/cryptoart/session/nonce', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: input.address, chainId: input.chainId, uri: window.location.origin }),
      })) as { message: string };
      const signature = await input.sign(nonce.message);
      return await parse(await fetch('/api/cryptoart/session/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: nonce.message, signature }),
      }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cryptoart-session'] }),
  });
  const signOut = useMutation({
    mutationFn: async () => parse(await fetch('/api/cryptoart/session', { method: 'DELETE', credentials: 'include' })),
    onSuccess: () => queryClient.setQueryData(['cryptoart-session'], null),
  });
  return { session, verify, signOut };
}
