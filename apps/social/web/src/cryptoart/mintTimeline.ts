import { and, desc, eq, getDatabase, collectionTokens } from '../../../../../packages/db/src/index';

export type MintTimelineItem = {
  id: string;
  chainId: number;
  contractAddress: string;
  tokenId: number;
  name: string | null;
  artist?: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  modelUrl: string | null;
  playerUrl: string | null;
  mediaType: string | null;
  mintedAt: string;
  href: string;
};

function arweaveToHttp(uri: string): string {
  if (uri.startsWith('ar://')) return `https://arweave.net/${uri.slice(5)}`;
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  return uri;
}

function mapMintRows(
  rows: Array<{
    id: string;
    chainId: number;
    contractAddress: string;
    tokenId: number;
    name: string | null;
    imageUrl: string | null;
    audioUrl: string | null;
    modelUrl: string | null;
    animationUrl: string | null;
    mediaType: string | null;
    mintedAt: Date;
    attributes: unknown;
  }>,
): MintTimelineItem[] {
  return rows.map((row) => {
    const attributes = Array.isArray(row.attributes)
      ? row.attributes as Array<{ trait_type?: string; value?: string | number }>
      : [];
    const artistAttr = attributes.find((attribute) => {
      const trait = attribute.trait_type?.toLowerCase();
      return trait === 'artist' || trait === 'creator';
    });
    return {
      id: row.id,
      chainId: row.chainId,
      contractAddress: row.contractAddress,
      tokenId: row.tokenId,
      name: row.name,
      artist: typeof artistAttr?.value === 'string' ? artistAttr.value : null,
      imageUrl: row.imageUrl ? arweaveToHttp(row.imageUrl) : null,
      audioUrl: row.audioUrl ? arweaveToHttp(row.audioUrl) : null,
      modelUrl: row.modelUrl ? arweaveToHttp(row.modelUrl) : null,
      playerUrl: row.animationUrl ? arweaveToHttp(row.animationUrl) : null,
      mediaType: row.mediaType,
      mintedAt: row.mintedAt.toISOString(),
      href: `https://cryptoart.studio/c/${row.chainId}/${row.contractAddress}/${row.tokenId}`,
    };
  });
}

export async function fetchRecentAudioMints(limit = 12): Promise<MintTimelineItem[]> {
  return fetchRecentMediaMints('audio', limit);
}

export async function fetchRecentModelMints(limit = 12): Promise<MintTimelineItem[]> {
  return fetchRecentMediaMints('model', limit);
}

export async function fetchRecentMediaMints(mediaType: 'audio' | 'model', limit = 12): Promise<MintTimelineItem[]> {
  const db = getDatabase();
  const rows = await db
    .select({
      id: collectionTokens.id,
      chainId: collectionTokens.chainId,
      contractAddress: collectionTokens.contractAddress,
      tokenId: collectionTokens.tokenId,
      name: collectionTokens.name,
      imageUrl: collectionTokens.imageUrl,
      audioUrl: collectionTokens.audioUrl,
      modelUrl: collectionTokens.modelUrl,
      animationUrl: collectionTokens.animationUrl,
      mediaType: collectionTokens.mediaType,
      mintedAt: collectionTokens.mintedAt,
      attributes: collectionTokens.attributes,
    })
    .from(collectionTokens)
    .where(and(eq(collectionTokens.metadataStatus, 'resolved'), eq(collectionTokens.mediaType, mediaType)))
    .orderBy(desc(collectionTokens.mintedAt))
    .limit(limit);

  return mapMintRows(rows);
}