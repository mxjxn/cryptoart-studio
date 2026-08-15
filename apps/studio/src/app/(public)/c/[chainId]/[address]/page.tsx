'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import { ChainBadge } from '~/components/ui/ChainBadge';
import { CopyAddress } from '~/components/ui/CopyAddress';
import { ArtCard } from '~/components/ui/ArtCard';
import { addressesMatch } from '~/lib/format';

const CHAIN_NAMES: Record<string, string> = {
  '8453': 'Base',
  '1': 'Ethereum',
  '11155111': 'Sepolia',
};

interface Collection {
  id: string;
  name: string;
  symbol: string;
  chainId: number;
  contractAddress: string;
  ownerAddress: string;
  totalSupply: number;
  description?: string | null;
  imageUrl?: string | null;
  bannerUrl?: string | null;
}

interface Token {
  id: string;
  tokenId: number;
  name: string | null;
  imageUrl: string | null;
}

export default function PublicCollectionPage({
  params,
}: {
  params: Promise<{ chainId: string; address: string }>;
}) {
  const { chainId: chainIdStr, address: contractAddress } = use(params);
  const { address: walletAddress, isConnected } = useActiveWallet();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/collections?chainId=${chainIdStr}&status=confirmed&limit=100`);
        const data = await res.json();
        const match = data.collections?.find(
          (c: Collection) => c.contractAddress.toLowerCase() === contractAddress.toLowerCase(),
        );
        if (match) {
          setCollection(match);
          const tokensRes = await fetch(`/api/collections/${match.id}/tokens?limit=100`);
          const tokensData = await tokensRes.json();
          setTokens(tokensData.tokens ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [chainIdStr, contractAddress]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex items-center gap-3 text-muted">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="mx-auto max-w-6xl px-12 py-16">
        <h1 className="text-2xl font-bold">Collection not found</h1>
        <p className="mt-2 text-muted">
          No confirmed collection exists at this address on chain {chainIdStr}.
        </p>
      </div>
    );
  }

  const chain = CHAIN_NAMES[chainIdStr] ?? `Chain ${chainIdStr}`;
  const isOwner = isConnected && walletAddress && addressesMatch(walletAddress, collection.ownerAddress);

  return (
    <div className="min-h-screen">
      {/* Hero banner */}
      <div className="h-80 bg-neutral-100">
        {collection.bannerUrl && (
          <img src={collection.bannerUrl} alt="" className="size-full object-cover" />
        )}
      </div>

      <div className="mx-auto max-w-[1440px] px-12 py-10">
        {/* Info strip */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold">{collection.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <CopyAddress address={collection.contractAddress} />
              <span className="text-muted">{collection.totalSupply} items</span>
              <ChainBadge chainName={chain} />
            </div>
            {collection.description && (
              <p className="mt-4 max-w-2xl text-muted">{collection.description}</p>
            )}
          </div>
          {isOwner && (
            <Link href={`/collections/${collection.id}`} className="studio-btn-outline">
              Manage Collection
            </Link>
          )}
        </div>

        {/* Art grid */}
        <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {tokens.map((token) => (
            <ArtCard
              key={token.id}
              href={`/c/${chainIdStr}/${contractAddress}/${token.tokenId}`}
              imageUrl={token.imageUrl}
              name={token.name ?? `Token #${token.tokenId}`}
              tokenId={token.tokenId}
            />
          ))}
        </div>

        {tokens.length === 0 && (
          <div className="py-16 text-center text-muted">No tokens minted in this collection yet.</div>
        )}
      </div>
    </div>
  );
}
