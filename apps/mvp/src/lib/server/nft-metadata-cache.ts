import { unstable_cache } from "next/cache";
import type { Address } from "viem";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import type { NFTMetadata } from "~/lib/nft-metadata";

/** Tag for `revalidateTag` when artwork metadata is manually refreshed. */
export function nftMetadataRevalidateTag(contractAddress: Address, tokenId: string): string {
  return `nft-metadata-${String(contractAddress).toLowerCase()}-${tokenId}`;
}

/**
 * IPFS / tokenURI resolution for artwork — safe to cache a long time.
 * Listing bids/prices still come from the subgraph on each browse/ISR pass.
 */
const NFT_METADATA_CACHE_SECONDS = 7 * 24 * 60 * 60; // 7d

export async function fetchNFTMetadataCached(
  contractAddress: Address,
  tokenId: string | undefined,
  tokenSpec: "ERC721" | "ERC1155" | number
): Promise<NFTMetadata | null> {
  if (!tokenId) return null;
  const addr = String(contractAddress).toLowerCase();
  const spec = String(tokenSpec);
  const tag = nftMetadataRevalidateTag(contractAddress, tokenId);
  return unstable_cache(
    async () => fetchNFTMetadata(contractAddress, tokenId, tokenSpec),
    ["nft-metadata-browse", addr, tokenId, spec],
    { revalidate: NFT_METADATA_CACHE_SECONDS, tags: [tag] }
  )();
}
