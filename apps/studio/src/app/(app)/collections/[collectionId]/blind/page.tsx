'use client';

import { use } from 'react';
import type { Address } from 'viem';
import { BlindDropFlow } from '~/components/create/BlindDropFlow';
import { useCollection } from '~/hooks/useCollections';

export default function BlindDropPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = use(params);
  const { data: collection, isLoading, error } = useCollection(collectionId);

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-8 py-16 text-muted">Loading collection…</div>;
  }
  if (error || !collection) {
    return <div className="mx-auto max-w-3xl px-8 py-16 text-error">Couldn’t load this collection.</div>;
  }

  return (
    <BlindDropFlow
      collectionId={collectionId}
      collectionName={collection.name}
      collectionAddress={collection.contractAddress as Address}
      chainId={collection.chainId}
      previewImage={collection.imageUrl}
    />
  );
}
