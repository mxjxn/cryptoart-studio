'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useCollection, useCollectionTokens, chainName } from '~/hooks/useCollections';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import { ChainBadge } from '~/components/ui/ChainBadge';
import { CopyAddress } from '~/components/ui/CopyAddress';
import { TabNav } from '~/components/ui/TabNav';
import { WalletMismatchBanner } from '~/components/WalletMismatchBanner';
import { truncateAddress } from '~/lib/format';
import { cn } from '~/lib/utils';

type Tab = 'tokens' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'settings', label: 'Settings' },
];

export default function CollectionPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = use(params);
  const [activeTab, setActiveTab] = useState<Tab>('tokens');
  const { isConnected } = useActiveWallet();
  const { data: collection, isLoading, error } = useCollection(collectionId);
  const { data: tokensData, isLoading: tokensLoading } = useCollectionTokens(collectionId);

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-6xl px-20 py-16">
        <p className="text-lg text-muted">Connect your wallet to view this collection.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-20 py-16">
        <div className="flex items-center gap-3 text-muted">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
          </svg>
          Loading collection…
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="mx-auto max-w-6xl px-20 py-16">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-800">
          Failed to load collection. It may not exist or you may not have access.
        </div>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-muted hover:text-foreground">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const tokens = tokensData?.tokens ?? [];
  const chain = chainName(collection.chainId);

  return (
    <div className="relative min-h-[calc(100vh-122px)]">
      <div className="mx-auto max-w-[1440px] px-20 py-10">
        {/* Wallet mismatch warning */}
        <WalletMismatchBanner ownerAddress={collection.ownerAddress} className="mb-6" />

        {/* Header */}
        <div className="flex items-start gap-6">
          {/* Branding placeholder */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-border bg-neutral-50">
            {collection.imageUrl ? (
              <img
                src={collection.imageUrl}
                alt={collection.name}
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )}
          </div>

          <div className="flex-1">
            <h1 className="text-3xl font-extrabold">{collection.name}</h1>

            <div className="mt-2 flex items-center gap-4">
              <CopyAddress address={collection.contractAddress} />
            </div>

            {/* Stats row */}
            <div className="mt-4 flex items-center gap-6">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-semibold text-foreground">{collection.totalSupply}</span>
                <span className="text-muted">items</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-semibold text-foreground">—</span>
                <span className="text-muted">volume</span>
              </div>
              <ChainBadge chainName={chain} />
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <TabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} className="mt-10" />

        {/* Tab content */}
        {activeTab === 'tokens' ? (
          <TokensTab
            tokens={tokens}
            tokensLoading={tokensLoading}
            collectionId={collectionId}
            chainId={collection.chainId}
            contractAddress={collection.contractAddress}
          />
        ) : (
          <SettingsTab collection={collection} />
        )}
      </div>

      {/* Floating Mint button */}
      <div className="sticky bottom-0 flex justify-end px-20 pb-6 pt-4">
        <Link
          href={`/collections/${collectionId}/mint`}
          className="studio-btn gap-2 shadow-lg shadow-black/10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Mint
        </Link>
      </div>
    </div>
  );
}

/* ─── Tokens Tab ─── */

interface Token {
  id: string;
  collectionId: string;
  tokenId: string;
  name: string | null;
  imageUrl: string | null;
  ownerAddress: string | null;
  mintedAt: string | null;
}

function TokensTab({
  tokens,
  tokensLoading,
  collectionId,
  chainId,
  contractAddress,
}: {
  tokens: Token[];
  tokensLoading: boolean;
  collectionId: string;
  chainId: number;
  contractAddress: string;
}) {
  if (tokensLoading) {
    return (
      <div className="flex items-center gap-3 py-12 text-sm text-muted">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
        </svg>
        Loading tokens…
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">No tokens minted yet</p>
        <p className="mt-1 text-sm text-muted">
          Mint your first token to see it here.
        </p>
        <Link
          href={`/collections/${collectionId}/mint`}
          className="studio-btn mt-6 inline-flex gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Mint Token
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-neutral-50">
          <tr>
            <th className="px-6 py-3 font-medium text-muted">Token ID</th>
            <th className="px-6 py-3 font-medium text-muted">Name</th>
            <th className="px-6 py-3 font-medium text-muted">Image</th>
            <th className="px-6 py-3 font-medium text-muted">Owner</th>
            <th className="px-6 py-3 font-medium text-muted">Mint Date</th>
            <th className="px-6 py-3 font-medium text-muted">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tokens.map((token) => (
            <tr key={token.id} className="h-16">
              <td className="px-6 font-mono text-xs font-medium">#{token.tokenId}</td>
              <td className="px-6 font-medium">{token.name ?? '—'}</td>
              <td className="px-6">
                {token.imageUrl ? (
                  <img
                    src={token.imageUrl}
                    alt={token.name ?? `Token #${token.tokenId}`}
                    className="h-10 w-10 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-100">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
              </td>
              <td className="px-6 font-mono text-xs text-muted">
                {token.ownerAddress ? truncateAddress(token.ownerAddress) : '—'}
              </td>
              <td className="px-6 text-muted">
                {token.mintedAt ? new Date(token.mintedAt).toLocaleDateString() : '—'}
              </td>
              <td className="px-6">
                <div className="flex gap-2">
                  <Link
                    href={`/collections/${collectionId}/tokens/${token.tokenId}`}
                    className="studio-btn-outline px-3.5 py-1.5 text-sm"
                  >
                    Manage
                  </Link>
                  <Link
                    href={`/c/${chainId}/${contractAddress}/${token.tokenId}`}
                    className="studio-btn-outline px-3.5 py-1.5 text-sm"
                  >
                    View
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Settings Tab ─── */

function SettingsTab({ collection }: { collection: Record<string, unknown> }) {
  const fields = [
    { label: 'Collection Name', value: collection.name as string },
    { label: 'Symbol', value: collection.symbol as string },
    { label: 'Description', value: (collection.description as string) || '' },
    { label: 'Contract Address', value: collection.contractAddress as string },
    { label: 'Owner Address', value: collection.ownerAddress as string },
  ];

  return (
    <div className="mt-8 max-w-2xl">
      <div className="rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold">Collection Metadata</h3>
        <p className="mt-1 text-sm text-muted">
          On-chain metadata editing coming soon. Fields are read-only for now.
        </p>

        <div className="mt-6 space-y-5">
          {fields.map((field) => (
            <div key={field.label}>
              <label className="block text-sm font-medium text-foreground">
                {field.label}
              </label>
              <input
                type="text"
                value={field.value}
                disabled
                className={cn(
                  'mt-1.5 w-full rounded-lg border border-border bg-neutral-50 px-3 py-2 text-sm text-muted',
                  'cursor-not-allowed opacity-70',
                )}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
