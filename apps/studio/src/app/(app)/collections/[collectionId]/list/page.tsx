'use client';

import { Suspense, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ListTokenForm } from '~/components/listing/ListTokenForm';
import { useCollection } from '~/hooks/useCollections';
import { useActiveWallet } from '~/hooks/useActiveWallet';

export default function ListTokenRoute({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  return (
    <Suspense fallback={<p className="px-20 py-16 text-muted">Loading listing…</p>}>
      <ListTokenScreen params={params} />
    </Suspense>
  );
}

function ListTokenScreen({ params }: { params: Promise<{ collectionId: string }> }) {
  const { collectionId } = use(params);
  const search = useSearchParams();
  const { address, isConnected } = useActiveWallet();
  const { data: collection, isLoading, error } = useCollection(collectionId);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h2 className="text-2xl font-bold">Connect your wallet</h2>
        <p className="mt-2 text-muted">You need a connected wallet to list a token.</p>
      </div>
    );
  }

  if (isLoading) return <p className="px-20 py-16 text-muted">Loading collection…</p>;

  if (error || !collection?.contractAddress || !collection.chainId) {
    return (
      <div className="px-20 py-16">
        <p className="text-sm text-error">This collection could not be loaded.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-muted hover:text-foreground">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const standard = collection.tokenStandard === 'erc1155' ? 'erc1155' : 'erc721';

  return (
    <ListTokenForm
      collectionId={collectionId}
      collectionName={collection.name ?? 'Collection'}
      chainId={collection.chainId}
      contractAddress={collection.contractAddress}
      tokenStandard={standard}
      owner={address}
      tokenId={search.get('tokenId')}
      metadataUri={search.get('metadataUri')}
      mintTxHash={search.get('mintTx')}
      quantity={search.get('quantity')}
    />
  );
}
