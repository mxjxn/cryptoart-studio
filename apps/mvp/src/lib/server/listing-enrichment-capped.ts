import type { Address } from "viem";
import { CHAIN_ID } from "~/lib/contracts/marketplace";
import { ETHEREUM_MAINNET_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import { fetchNFTMetadata, type NFTMetadata } from "~/lib/nft-metadata";

const NFT_ENRICH_BUDGET_MS = 14_000;
const THUMB_BUDGET_MS = 8_000;

/** Resolve with `fallback` if `promise` does not settle within `ms`. */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function buildListingThumbnailsFromImage(
  image: string,
  logLabel = "[listing-enrichment]"
): Promise<{ thumbnailUrl: string; detailThumbnailUrl?: string }> {
  const { getOrGenerateThumbnail } = await import("~/lib/server/thumbnail-generator");
  const { getCachedThumbnail } = await import("~/lib/server/thumbnail-cache");
  let smallThumb: string | undefined;
  try {
    smallThumb = await getOrGenerateThumbnail(image, "small");
  } catch (e) {
    console.warn(`${logLabel} Failed to generate small thumbnail for ${image}:`, e);
  }
  const thumbnailUrl = smallThumb ?? image;
  const detailThumbnailUrl = (await getCachedThumbnail(image, "detail")) ?? undefined;
  if (!detailThumbnailUrl) {
    void (async () => {
      try {
        await getOrGenerateThumbnail(image, "detail");
      } catch (e) {
        console.warn(
          `${logLabel} Background detail thumbnail failed for ${image}:`,
          e
        );
      }
    })();
  }
  return { thumbnailUrl, detailThumbnailUrl };
}

export type CappedListingMediaResult = {
  metadata: NFTMetadata | null;
  erc1155TotalSupply: string | undefined;
  erc721TotalSupply: number | undefined;
  thumbnailUrl: string | undefined;
  detailThumbnailUrl: string | undefined;
  nftChainId: number;
};

/**
 * Bounded metadata + optional Base-only supply reads + thumbnails.
 * Used by `GET /api/auctions` and `getAuctionServer` so OG/detail paths do not hang on IPFS / wrong-chain RPC.
 */
export async function enrichListingMediaAndSupplyCapped(
  listing: Record<string, unknown>,
  opts: { listingIdForLog: string; requestChainId?: number }
): Promise<CappedListingMediaResult> {
  const rawMetaCid = listing.chainId;
  const parsedMetaCid =
    typeof rawMetaCid === "number"
      ? rawMetaCid
      : parseInt(String(rawMetaCid ?? ""), 10);
  const nftChainId = Number.isFinite(parsedMetaCid)
    ? parsedMetaCid
    : opts.requestChainId ?? CHAIN_ID;
  const skipBaseOnlySupply = nftChainId === ETHEREUM_MAINNET_CHAIN_ID;

  const tokenAddress = listing.tokenAddress as string | undefined;
  const tokenId = listing.tokenId as string | undefined;
  const tokenSpec = listing.tokenSpec as "ERC721" | "ERC1155" | number | undefined;

  const metadataPromise =
    tokenAddress && tokenId
      ? fetchNFTMetadata(
          tokenAddress as Address,
          tokenId,
          tokenSpec as "ERC721" | "ERC1155",
          nftChainId
        ).catch((error) => {
          console.error(
            `[listing-enrichment] Error fetching metadata for ${tokenAddress}:${tokenId} (listing ${opts.listingIdForLog}):`,
            error
          );
          return null;
        })
      : Promise.resolve(null);

  const erc1155Promise =
    !skipBaseOnlySupply &&
    (tokenSpec === "ERC1155" || tokenSpec === 2) &&
    tokenAddress &&
    tokenId
      ? import("~/lib/server/erc1155-supply").then(async ({ getERC1155TotalSupply }) => {
          try {
            const totalSupply = await getERC1155TotalSupply(tokenAddress, tokenId);
            return totalSupply !== null ? totalSupply.toString() : undefined;
          } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(
              `[listing-enrichment] ERC1155 supply ${tokenAddress}:${tokenId}:`,
              errorMsg
            );
            return undefined;
          }
        })
      : Promise.resolve(undefined);

  const erc721Promise =
    !skipBaseOnlySupply &&
    (tokenSpec === "ERC721" || tokenSpec === 1) &&
    tokenAddress
      ? import("~/lib/erc721-supply").then(async ({ fetchERC721TotalSupply }) => {
          try {
            const totalSupply = await fetchERC721TotalSupply(tokenAddress);
            return totalSupply !== null ? totalSupply : undefined;
          } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(
              `[listing-enrichment] ERC721 supply ${tokenAddress}:`,
              errorMsg
            );
            return undefined;
          }
        })
      : Promise.resolve(undefined);

  const enrichmentBundle = Promise.all([
    metadataPromise,
    erc1155Promise,
    erc721Promise,
  ]);
  const [metadata, erc1155TotalSupply, erc721TotalSupply] = (await withTimeout(
    enrichmentBundle,
    NFT_ENRICH_BUDGET_MS,
    [null, undefined, undefined]
  )) as [NFTMetadata | null, string | undefined, number | undefined];

  let thumbnailUrl: string | undefined;
  let detailThumbnailUrl: string | undefined;
  if (metadata?.image) {
    const image = metadata.image;
    try {
      const out = await withTimeout(
        buildListingThumbnailsFromImage(image, "[listing-enrichment]"),
        THUMB_BUDGET_MS,
        { thumbnailUrl: image }
      );
      thumbnailUrl = out.thumbnailUrl;
      detailThumbnailUrl = out.detailThumbnailUrl;
    } catch (error) {
      console.warn(
        `[listing-enrichment] Thumbnails failed for ${image} (listing ${opts.listingIdForLog}):`,
        error
      );
      thumbnailUrl = image;
    }
  }

  return {
    metadata,
    erc1155TotalSupply,
    erc721TotalSupply,
    thumbnailUrl,
    detailThumbnailUrl,
    nftChainId,
  };
}
