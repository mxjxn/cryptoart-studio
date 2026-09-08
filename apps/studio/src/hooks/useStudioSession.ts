'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type StudioSession = {
  address: string;
  capabilities: { owner: boolean; roles: boolean; publish: boolean; submit: boolean };
};

async function parse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || 'Request failed');
  return body;
}

export function useStudioSession() {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ['studio-session'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/session', { signal, credentials: 'include' });
      if (response.status === 401) return null;
      return await parse(response) as StudioSession;
    },
    retry: false,
  });
  const verify = useMutation({
    mutationFn: async (input: { address: string; chainId: number; sign: (message: string) => Promise<`0x${string}`> }) => {
      const nonce = await parse(await fetch('/api/session/nonce', {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: input.address, chainId: input.chainId, uri: window.location.origin }),
      })) as { message: string };
      const signature = await input.sign(nonce.message);
      return parse(await fetch('/api/session/verify', {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: nonce.message, signature }),
      }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['studio-session'] }),
  });
  return { session, verify };
}
