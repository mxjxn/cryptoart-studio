'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCollection, chainName } from '~/hooks/useCollections';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import { useMarketplaceAddress } from '~/hooks/useMarketplaceAddress';
import { listingHandoffPath } from '~/components/listing/handoff';
import { CopyAddress } from '~/components/ui/CopyAddress';
import { ChainBadge } from '~/components/ui/ChainBadge';
import { truncateAddress } from '~/lib/format';
import { txExplorerUrl } from '~/lib/txExplorer';

interface TokenDetail {
  tokenId: string;
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  ownerAddress: string | null;
  mintTxHash: string | null;
  mintedAt: string | null;
  tokenURI: string | null;
}

export default function CollectionTokenPage({
  params,
}: {
  params: Promise<{ collectionId: string; tokenId: string }>;
}) {
  const { collectionId, tokenId } = use(params);
  const { address, isConnected } = useActiveWallet();
  const { data: collection, isLoading: collectionLoading, error: collectionError } = useCollection(collectionId);
  const marketplaceQuery = useMarketplaceAddress(collection?.chainId);
  const [token, setToken] = useState<TokenDetail | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setTokenLoading(true);
      setTokenError(null);
      try {
        const res = await fetch(`/api/collections/${collectionId}/tokens/${tokenId}`);
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error || 'Token not found');
        }
        const data = (await res.json()) as TokenDetail;
        if (!cancelled) setToken(data);
      } catch (error) {
        if (!cancelled) setTokenError(error instanceof Error ? error.message : 'Failed to load token');
      } finally {
        if (!cancelled) setTokenLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [collectionId, tokenId]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h2 className="text-2xl font-bold">Connect your wallet</h2>
        <p className="mt-2 text-muted">Sign in to manage tokens in your studio collections.</p>
      </div>
    );
  }

  if (collectionLoading || tokenLoading) {
    return <p className="px-20 py-16 text-muted">Loading token…</p>;
  }

  if (collectionError || !collection?.contractAddress || !collection.chainId) {
    return (
      <div className="px-20 py-16">
        <p className="text-sm text-error">This collection could not be loaded.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-muted hover:text-foreground">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (tokenError || !token) {
    return (
      <div className="px-20 py-16">
        <p className="text-sm text-error">{tokenError ?? 'Token not found'}</p>
        <Link href={`/collections/${collectionId}`} className="mt-4 inline-block text-sm text-muted hover:text-foreground">
          Back to collection
        </Link>
      </div>
    );
  }

  const listingEnabled = marketplaceQuery.isSuccess && Boolean(marketplaceQuery.data);
  const listHref = listingHandoffPath(collectionId, {
    tokenId,
    metadataUri: token.tokenURI,
    mintTxHash: token.mintTxHash,
  });
  const publicHref = `/c/${collection.chainId}/${collection.contractAddress}/${tokenId}`;
  const mintExplorer = token.mintTxHash ? txExplorerUrl(collection.chainId, token.mintTxHash) : null;
  const ownsToken =
    Boolean(address) && Boolean(token.ownerAddress) && token.ownerAddress!.toLowerCase() === address!.toLowerCase();

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-20 py-10">
      <nav className="flex items-center gap-1.5 text-sm text-muted">
        <Link href={`/collections/${collectionId}`} className="hover:text-foreground">
          {collection.name}
        </Link>
        <span>›</span>
        <span className="text-foreground">Token #{tokenId}</span>
      </nav>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex max-w-md flex-col gap-4">
          {token.imageUrl ? (
            <img src={token.imageUrl} alt={token.name ?? `Token #${tokenId}`} className="w-full rounded-lg border border-border object-cover" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-border bg-neutral-50 text-sm text-muted">
              No preview image
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href={publicHref} className="studio-btn-outline px-4 py-2 text-sm">
              Public token page
            </Link>
            {ownsToken && listingEnabled && (
              <Link href={listHref} className="studio-btn px-4 py-2 text-sm">
                List on auction house
              </Link>
            )}
            {ownsToken && marketplaceQuery.isSuccess && !listingEnabled && (
              <span className="rounded-lg border border-border px-4 py-2 text-sm text-muted">
                Listing unavailable on {chainName(collection.chainId)}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-5 text-sm">
          <div>
            <h1 className="text-3xl font-bold">{token.name ?? `Token #${tokenId}`}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <ChainBadge chainName={chainName(collection.chainId)} />
              <CopyAddress address={collection.contractAddress} />
            </div>
          </div>
          {token.description && <p className="text-muted">{token.description}</p>}
          <dl className="grid gap-3 rounded-lg border border-border p-5">
            <Row label="Token id" value={`#${tokenId}`} />
            <Row label="Owner" value={token.ownerAddress ? truncateAddress(token.ownerAddress) : '—'} mono />
            <Row label="Minted" value={token.mintedAt ? new Date(token.mintedAt).toLocaleString() : '—'} />
            <Row label="Metadata URI" value={token.tokenURI ?? '—'} mono />
            {token.mintTxHash && (
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted">Mint transaction</dt>
                <dd className="max-w-[420px] truncate font-mono text-xs">
                  {mintExplorer ? (
                    <a href={mintExplorer} target="_blank" rel="noreferrer" className="underline">
                      {token.mintTxHash}
                    </a>
                  ) : (
                    token.mintTxHash
                  )}
                </dd>
              </div>
            )}
          </dl>
          {!ownsToken && address && (
            <p className="text-muted">Your wallet does not own this token. Listing is only shown to the current owner.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-3">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? 'max-w-[520px] truncate text-right font-mono text-xs' : 'text-right'}>{value}</dd>
    </div>
  );
}
