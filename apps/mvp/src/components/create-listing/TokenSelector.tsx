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

  // Fetch NFTs when contract address or page changes
  useEffect(() => {
    if (!contractAddress || !address) return;

    async function fetchNFTs() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/nfts/for-owner?owner=${encodeURIComponent(address!)}&contractAddress=${encodeURIComponent(contractAddress)}&page=${page}&limit=${limit}`
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
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-light mb-2">Select Token</h2>
        <p className="text-sm text-[#999999] mb-4">
          Choose a token from this contract to list
        </p>
      </div>

      {loading && nfts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-8 w-8 border-2 border-[#666666] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-[#999999]">Loading your tokens...</p>
        </div>
      ) : nfts.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-6 text-center">
          <p className="text-[#999999]">No tokens found in this contract.</p>
        </div>
      ) : (
        <>
          {/* NFT Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {nfts.map((nft) => (
              <button
                key={nft.tokenId}
                type="button"
                onClick={() => onSelectToken(nft.tokenId)}
                className={`group relative aspect-square rounded-lg border overflow-hidden transition-colors ${
                  selectedTokenId === nft.tokenId
                    ? "border-white ring-2 ring-white"
                    : "border-[#333333] hover:border-[#555555]"
                }`}
              >
                <div className="w-full h-full bg-[#0a0a0a]">
                  <MediaDisplay
                    imageUrl={nft.image || undefined}
                    animationUrl={nft.animationUrl || undefined}
                    animationFormat={nft.animationFormat || undefined}
                    alt={nft.name || `Token #${nft.tokenId}`}
                    className="w-full h-full"
                  />
                </div>
                {/* Overlay with token info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <p className="text-white text-sm font-medium truncate mb-1">
                    {nft.name || `Token #${nft.tokenId}`}
                  </p>
                  {tokenType === "ERC1155" && nft.balance && (
                    <p className="text-xs text-[#cccccc]">
                      {nft.balance} available
                    </p>
                  )}
                </div>
                {/* Selected indicator */}
                {selectedTokenId === nft.tokenId && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                    <span className="text-black text-sm font-bold">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-[#333333]">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={page === 1 || loading}
                className="px-4 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm font-medium rounded hover:border-[#555555] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-[#999999]">
                Page {page} of {totalPages} ({total} total)
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={!hasMore || loading}
                className="px-4 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm font-medium rounded hover:border-[#555555] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

