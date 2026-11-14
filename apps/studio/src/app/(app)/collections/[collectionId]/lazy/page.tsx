'use client';

import { use } from 'react';
import { LazyMintFlow } from '~/components/create/LazyMintFlow';
import { useCollection } from '~/hooks/useCollections';
import type { Address } from 'viem';

export default function LazyMintPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = use(params);
  const { data: collection, isLoading, error } = useCollection(collectionId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 text-muted">Loading collection…</div>
    );
  }

  if (error || !collection) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 text-error">
        Couldn’t load this collection.
      </div>
    );
  }

  return (
    <LazyMintFlow
      collectionId={collectionId}
      collectionName={collection.name}
      collectionAddress={collection.contractAddress as Address}
      chainId={collection.chainId}
      tokenStandard={(collection.tokenStandard as 'erc721' | 'erc1155' | undefined) ?? 'erc721'}
      previewImage={collection.imageUrl}
    />
  );
}
