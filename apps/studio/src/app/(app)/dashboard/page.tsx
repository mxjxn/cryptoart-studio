'use client';

import Link from 'next/link';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import { useCollections, chainName } from '~/hooks/useCollections';
import { useDrafts } from '~/hooks/useDrafts';
import { ChainBadge } from '~/components/ui/ChainBadge';
import { ConnectWalletButton } from '~/components/ConnectWalletButton';

export default function DashboardPage() {
  const { isConnected, address } = useActiveWallet();
  const { data: collectionsData, isLoading: collectionsLoading } = useCollections();
  const { data: drafts, isLoading: draftsLoading } = useDrafts();

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-6xl px-20 py-16">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-4xl font-extrabold">Your studio</h1>
            <p className="mt-2 text-lg text-muted">
              Connect your wallet to deploy collections and mint work.
            </p>
          </div>
          <ConnectWalletButton />
        </div>
      </div>
    );
  }

  const collections = collectionsData?.collections ?? [];
  const draftCount = drafts?.length ?? 0;

  return (
    <div className="mx-auto max-w-[1440px] px-20 py-16">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-3.5">
          <div>
            <h1 className="text-4xl font-extrabold">Your studio</h1>
            <p className="mt-2 text-lg text-muted">
              Deploy collections, mint work, and manage contracts.
            </p>
          </div>
          <Link href="/collections/new" className="studio-btn w-fit gap-2">
            + Create Collection
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>

        {draftCount > 0 && (
          <div className="rounded-lg border border-border px-6 py-6">
            <Link href="/collections/new" className="flex items-center gap-1 text-sm font-medium text-foreground hover:underline">
              {draftCount} draft{draftCount !== 1 ? 's' : ''}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
            <p className="mt-2 text-sm text-muted">Resume where you left off.</p>
          </div>
        )}
      </div>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">Your collections</h2>

        <div className="mt-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-neutral-50">
              <tr>
                <th className="px-6 py-3 font-medium text-muted">Collection Name</th>
                <th className="px-6 py-3 font-medium text-muted">Chain</th>
                <th className="px-6 py-3 font-medium text-muted">Items</th>
                <th className="px-6 py-3 font-medium text-muted">Volume</th>
                <th className="px-6 py-3 font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {collectionsLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted">Loading…</td>
                </tr>
              ) : collections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted">
                    No collections yet. Create your first collection to get started.
                  </td>
                </tr>
              ) : (
                collections.map((c) => (
                  <tr key={c.id} className="h-16">
                    <td className="px-6 font-medium">{c.name}</td>
                    <td className="px-6">
                      <ChainBadge chainName={chainName(c.chainId)} />
                    </td>
                    <td className="px-6 text-muted">{c.totalSupply}</td>
                    <td className="px-6 text-muted">—</td>
                    <td className="px-6">
                      <div className="flex gap-2">
                        <Link href={`/collections/${c.id}`} className="studio-btn-outline px-3.5 py-1.5 text-sm">
                          Manage
                        </Link>
                        <Link href={`/c/${c.chainId}/${c.contractAddress}`} className="studio-btn-outline px-3.5 py-1.5 text-sm">
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
