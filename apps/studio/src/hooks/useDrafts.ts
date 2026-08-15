'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActiveWallet } from '~/hooks/useActiveWallet';

export interface DraftPayload {
  step: number;
  chainId?: number;
  editionType?: 'one' | 'multiple';
  name?: string;
  symbol?: string;
  royaltiesOptOut?: boolean;
  branding?: {
    description?: string;
    imageUrl?: string;
    bannerUrl?: string;
  };
}

export interface Draft {
  id: string;
  ownerAddress: string;
  payload: DraftPayload;
  createdAt: string;
  updatedAt: string;
}

async function fetchDrafts(owner: string): Promise<Draft[]> {
  const res = await fetch(`/api/drafts?owner=${owner}`);
  if (!res.ok) throw new Error('Failed to fetch drafts');
  const data = await res.json();
  return data.drafts;
}

export function useDrafts() {
  const { address, isConnected } = useActiveWallet();

  return useQuery({
    queryKey: ['drafts', address],
    queryFn: () => fetchDrafts(address!),
    enabled: isConnected && !!address,
  });
}

export function useCreateDraft() {
  const queryClient = useQueryClient();
  const { address } = useActiveWallet();

  return useMutation({
    mutationFn: async (payload: DraftPayload) => {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerAddress: address, payload }),
      });
      if (!res.ok) throw new Error('Failed to create draft');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drafts'] }),
  });
}

export function useUpdateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: DraftPayload }) => {
      const res = await fetch(`/api/drafts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      if (!res.ok) throw new Error('Failed to update draft');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drafts'] }),
  });
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete draft');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drafts'] }),
  });
}
