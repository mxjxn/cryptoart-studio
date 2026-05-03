"use client";

import { useState, useEffect } from "react";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { MediaDisplay } from "~/components/media";

interface NFT {
  tokenId: string;
  name: string | null;
  image: string | null;
  animationUrl?: string | null;
  animationFormat?: string | null;
  balance?: string;
}

interface TokenSelectorProps {
  contractAddress: string;
  tokenType: "ERC721" | "ERC1155";
  selectedTokenId: string | null;
  onSelectToken: (tokenId: string) => void;
}

/**
 * TokenSelector component for page 2 of the create listing wizard
 * Displays paginated NFTs owned from the selected contract
 */
export function TokenSelector({
  contractAddress,
  tokenType,
  selectedTokenId,
  onSelectToken,
}: TokenSelectorProps) {
  const { address } = useEffectiveAddress();
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  useEffect(() => {
    if (!contractAddress || !address) return;

    async function fetchNFTs() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/nfts/for-owner?owner=${encodeURIComponent(address!)}&contractAddress=${encodeURIComponent(contractAddress)}&page=${page}&limit=${limit}`,
        );
        if (response.ok) {
          const data = await response.json();
          setNfts(data.nfts || []);
          setTotal(data.total || 0);
          setHasMore(data.hasMore || false);
        } else {
          console.error("Failed to fetch NFTs");
          setNfts([]);
        }
      } catch (error) {
        console.error("Error fetching NFTs:", error);
        setNfts([]);
      } finally {
        setLoading(false);
      }
    }

    fetchNFTs();
  }, [contractAddress, address, page]);

  const handleNextPage = () => {
    if (hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage((prev) => prev - 1);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4 font-space-grotesk">
      <div>
        <h2 className="mb-2 text-xl font-medium text-neutral-900">Select token</h2>
        <p className="mb-4 text-sm text-neutral-600">Choose a token from this contract to list.</p>
      </div>

      {loading && nfts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-600" />
          <p className="text-neutral-600">Loading your tokens…</p>
        </div>
      ) : nfts.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-center">
          <p className="text-neutral-600">No tokens found in this contract.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {nfts.map((nft) => (
              <button
                key={nft.tokenId}
                type="button"
                onClick={() => onSelectToken(nft.tokenId)}
                className={`group relative aspect-square overflow-hidden rounded-lg border transition-colors ${
                  selectedTokenId === nft.tokenId
                    ? "border-neutral-900 ring-2 ring-neutral-900"
                    : "border-neutral-200 hover:border-neutral-400"
                }`}
              >
                <div className="h-full w-full bg-neutral-100">
                  <MediaDisplay
                    imageUrl={nft.image || undefined}
                    animationUrl={nft.animationUrl || undefined}
                    animationFormat={nft.animationFormat || undefined}
                    alt={nft.name || `Token #${nft.tokenId}`}
                    className="h-full w-full"
                  />
                </div>
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="mb-1 truncate text-sm font-medium text-white">
                    {nft.name || `Token #${nft.tokenId}`}
                  </p>
                  {tokenType === "ERC1155" && nft.balance && (
                    <p className="text-xs text-neutral-200">{nft.balance} available</p>
                  )}
                </div>
                {selectedTokenId === nft.tokenId && (
                  <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white">
                    <span className="text-sm font-bold text-neutral-900">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={page === 1 || loading}
                className="rounded border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-neutral-600">
                Page {page} of {totalPages} ({total} total)
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={!hasMore || loading}
                className="rounded border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
