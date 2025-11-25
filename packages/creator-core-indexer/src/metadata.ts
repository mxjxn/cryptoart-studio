/**
 * NFT metadata fetching and caching utilities
 */

import { PublicClient, Address } from 'viem';
import { getSharedDatabase } from '@cryptoart/shared-db-config';
import { creatorCoreTokens, nftMetadataCache } from '@cryptoart/db';
import { eq, and } from 'drizzle-orm';

export interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
  attributes?: Array<{ trait_type: string; value: any }>;
}

/**
 * Fetch token URI from contract
 */
export async function fetchTokenURI(
  client: PublicClient,
  contractAddress: string,
  tokenId: string
): Promise<string | null> {
  try {
    const uri = await client.readContract({
      address: contractAddress as Address,
      abi: [
        {
          name: 'tokenURI',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'tokenId', type: 'uint256' }],
          outputs: [{ name: '', type: 'string' }],
        },
      ],
      functionName: 'tokenURI',
      args: [BigInt(tokenId)],
    });

    return uri || null;
  } catch (error) {
    console.error(`Error fetching tokenURI for ${contractAddress}/${tokenId}:`, error);
    return null;
  }
}

/**
 * Fetch metadata from URI (IPFS, HTTP, etc.)
 */
export async function fetchMetadataFromURI(uri: string): Promise<NFTMetadata | null> {
  try {
    // Handle IPFS URIs
    let fetchUrl = uri;
    if (uri.startsWith('ipfs://')) {
      fetchUrl = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    } else if (uri.startsWith('ipfs/')) {
      fetchUrl = `https://ipfs.io/ipfs/${uri.slice(5)}`;
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      return null;
    }

    const metadata = await response.json();
    return metadata as NFTMetadata;
  } catch (error) {
    console.error(`Error fetching metadata from ${uri}:`, error);
    return null;
  }
}

/**
 * Fetch and cache NFT metadata
 */
export async function fetchAndCacheMetadata(
  client: PublicClient,
  contractAddress: string,
  tokenId: string
): Promise<NFTMetadata | null> {
  const db = getSharedDatabase();
  const normalizedAddress = contractAddress.toLowerCase();

  // Check cache first
  const cached = await db
    .select()
    .from(nftMetadataCache)
    .where(
      and(
        eq(nftMetadataCache.contractAddress, normalizedAddress),
        eq(nftMetadataCache.tokenId, tokenId)
      )
    )
    .limit(1);

  if (cached.length > 0 && cached[0].refreshedAt) {
    // Return cached metadata
    return {
      name: cached[0].name || undefined,
      description: cached[0].description || undefined,
      image: cached[0].imageURI || undefined,
      animation_url: cached[0].animationURI || undefined,
      attributes: (cached[0].attributes as any) || undefined,
    };
  }

  // Fetch token URI
  const tokenURI = await fetchTokenURI(client, contractAddress, tokenId);
  if (!tokenURI) {
    return null;
  }

  // Fetch metadata from URI
  const metadata = await fetchMetadataFromURI(tokenURI);
  if (!metadata) {
    return null;
  }

  // Update cache
  if (cached.length > 0) {
    await db
      .update(nftMetadataCache)
      .set({
        name: metadata.name || null,
        description: metadata.description || null,
        imageURI: metadata.image || null,
        animationURI: metadata.animation_url || null,
        attributes: metadata.attributes || null,
        tokenURI,
        metadataSource: tokenURI.startsWith('ipfs://') ? 'ipfs' : 'contract',
        refreshedAt: new Date(),
      })
      .where(
        and(
          eq(nftMetadataCache.contractAddress, normalizedAddress),
          eq(nftMetadataCache.tokenId, tokenId)
        )
      );
  } else {
    await db.insert(nftMetadataCache).values({
      contractAddress: normalizedAddress,
      tokenId,
      name: metadata.name || null,
      description: metadata.description || null,
      imageURI: metadata.image || null,
      animationURI: metadata.animation_url || null,
      attributes: metadata.attributes || null,
      tokenURI,
      metadataSource: tokenURI.startsWith('ipfs://') ? 'ipfs' : 'contract',
    });
  }

  // Update token record with metadata
  await db
    .update(creatorCoreTokens)
    .set({
      tokenURI,
      metadata: metadata as any,
    })
    .where(
      and(
        eq(creatorCoreTokens.contractAddress, normalizedAddress),
        eq(creatorCoreTokens.tokenId, tokenId)
      )
    );

  return metadata;
}

