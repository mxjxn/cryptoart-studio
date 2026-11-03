'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { CopyAddress } from '~/components/ui/CopyAddress';
import { ChainBadge } from '~/components/ui/ChainBadge';
import { truncateAddress } from '~/lib/format';

const CHAIN_NAMES: Record<string, string> = {
  '8453': 'Base',
  '1': 'Ethereum',
  '11155111': 'Sepolia',
};

interface TokenDetail {
  tokenId: number;
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  animationUrl: string | null;
  attributes: { trait_type: string; value: string }[] | null;
  ownerAddress: string;
  mintTxHash: string;
  mintedAt: string;
  transferHistory?: {
    fromAddress: string;
    toAddress: string;
    eventType: string;
    txHash: string;
    timestamp: string;
  }[];
}

interface Collection {
  id: string;
  name: string;
  chainId: number;
  contractAddress: string;
}

export default function PublicTokenPage({
  params,
}: {
  params: Promise<{ chainId: string; address: string; tokenId: string }>;
}) {
  const { chainId: chainIdStr, address: contractAddress, tokenId } = use(params);

  const [collection, setCollection] = useState<Collection | null>(null);
  const [token, setToken] = useState<TokenDetail | null>(null);
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
          const tokenRes = await fetch(`/api/collections/${match.id}/tokens/${tokenId}`);
          const tokenData = await tokenRes.json();
          setToken(tokenData);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [chainIdStr, contractAddress, tokenId]);

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

  if (!collection || !token) {
    return (
      <div className="mx-auto max-w-6xl px-12 py-16">
        <h1 className="text-2xl font-bold">Token not found</h1>
        <p className="mt-2 text-muted">
          This token could not be found.
        </p>
      </div>
    );
  }

  const chain = CHAIN_NAMES[chainIdStr] ?? `Chain ${chainIdStr}`;
  const attrs = Array.isArray(token.attributes) ? token.attributes : [];

  return (
    <div className="mx-auto max-w-[1440px] px-12 py-10">
      <nav className="mb-8 text-sm text-muted">
        <Link href={`/c/${chainIdStr}/${contractAddress}`} className="hover:text-foreground">
          {collection.name}
        </Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">#{tokenId}</span>
      </nav>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* Artwork */}
        <div className="aspect-square overflow-hidden rounded-xl bg-neutral-100">
          {token.imageUrl ? (
            <img src={token.imageUrl} alt={token.name ?? ''} className="size-full object-contain" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="text-4xl font-extrabold">{token.name ?? `#${tokenId}`}</h1>

          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className="text-muted">
              Owned by <span className="font-mono text-foreground">{truncateAddress(token.ownerAddress)}</span>
            </span>
            <ChainBadge chainName={chain} />
          </div>

          {token.description && (
            <p className="mt-6 leading-relaxed text-muted">{token.description}</p>
          )}

          {/* Attributes */}
          {attrs.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-bold">Traits</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {attrs.map((attr, i) => (
                  <div key={i} className="rounded-lg border border-border px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">{attr.trait_type}</p>
                    <p className="mt-1 text-sm font-medium">{attr.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transfer History */}
          {token.transferHistory && token.transferHistory.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-bold">Activity</h2>
              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-neutral-50">
                    <tr>
                      <th className="px-4 py-2.5 font-medium text-muted">Event</th>
                      <th className="px-4 py-2.5 font-medium text-muted">From</th>
                      <th className="px-4 py-2.5 font-medium text-muted">To</th>
                      <th className="px-4 py-2.5 font-medium text-muted">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {token.transferHistory.map((tx, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 capitalize">{tx.eventType}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{truncateAddress(tx.fromAddress)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{truncateAddress(tx.toAddress)}</td>
                        <td className="px-4 py-2.5 text-muted">
                          {new Date(tx.timestamp).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
