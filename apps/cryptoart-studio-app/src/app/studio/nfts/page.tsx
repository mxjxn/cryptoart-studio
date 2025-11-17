"use client";

import { useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { AuthWrapper } from "~/components/AuthWrapper";
import Link from "next/link";
import { Image, Plus, ExternalLink } from "lucide-react";

export default function NFTsPage() {
  const { context, isSDKLoaded } = useMiniApp();

  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  // TODO: Fetch NFTs from API/subgraph
  const nfts: Array<{
    tokenId: string;
    contractAddress: string;
    contractName: string;
    tokenURI: string;
    owner: string;
    mintedAt: string;
  }> = [];

  return (
    <AuthWrapper>
      <MobileLayout title="My NFTs">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">NFTs</h1>
            <Link
              href="/studio/nfts/create"
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Link>
          </div>

          {/* NFTs List */}
          {nfts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No NFTs yet
              </h3>
              <p className="text-gray-600 mb-4">
                Create your first NFT to get started.
              </p>
              <Link
                href="/studio/nfts/create"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create NFT
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {nfts.map((nft) => (
                <div
                  key={`${nft.contractAddress}-${nft.tokenId}`}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900 mb-1">
                        {nft.contractName} #{nft.tokenId}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono mb-2">
                        {nft.contractAddress.slice(0, 6)}...
                        {nft.contractAddress.slice(-4)}
                      </p>
                      {nft.tokenURI && (
                        <a
                          href={nft.tokenURI}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          View Metadata →
                        </a>
                      )}
                    </div>
                    <a
                      href={`https://basescan.org/token/${nft.contractAddress}?a=${nft.tokenId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ExternalLink className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </MobileLayout>
    </AuthWrapper>
  );
}

