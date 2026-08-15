'use client';

import { useQuery } from '@tanstack/react-query';
import { useActiveWallet } from '~/hooks/useActiveWallet';

interface Collection {
  id: string;
  name: string;
  symbol: string;
  chainId: number;
  contractAddress: string;
  ownerAddress: string;
  totalSupply: number;
  status: string;
  description?: string | null;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  createdAt: string;
}

interface CollectionsResponse {
  collections: Collection[];
  total: number;
  limit: number;
  offset: number;
}

const CHAIN_NAMES: Record<number, string> = {
  8453: 'Base',
  1: 'Ethereum',
  11155111: 'Sepolia',
};

export function chainName(chainId: number): string {
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}

async function fetchCollections(owner?: string): Promise<CollectionsResponse> {
  const params = new URLSearchParams();
  if (owner) params.set('owner', owner);
  params.set('limit', '100');
  const res = await fetch(`/api/collections?${params}`);
  if (!res.ok) throw new Error('Failed to fetch collections');
  return res.json();
}

export function useCollections() {
  const { address, isConnected } = useActiveWallet();

  return useQuery({
    queryKey: ['collections', address],
    queryFn: () => fetchCollections(address),
    enabled: isConnected && !!address,
  });
}

async function fetchCollection(id: string) {
  const res = await fetch(`/api/collections/${id}`);
  if (!res.ok) throw new Error('Failed to fetch collection');
  return res.json();
}

export function useCollection(id: string) {
  return useQuery({
    queryKey: ['collection', id],
    queryFn: () => fetchCollection(id),
    enabled: !!id,
  });
}

async function fetchTokens(collectionId: string) {
  const res = await fetch(`/api/collections/${collectionId}/tokens?limit=100`);
  if (!res.ok) throw new Error('Failed to fetch tokens');
  return res.json();
}

export function useCollectionTokens(collectionId: string) {
  return useQuery({
    queryKey: ['collection-tokens', collectionId],
    queryFn: () => fetchTokens(collectionId),
    enabled: !!collectionId,
  });
}
