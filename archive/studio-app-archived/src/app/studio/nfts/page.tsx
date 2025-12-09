"use client";

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

import { useEffect, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import Link from "next/link";
import { Image, Plus, ExternalLink, Loader2 } from "lucide-react";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { AuthWrapper } from "~/components/AuthWrapper";

interface Mint {
  id: string;
  collectionId: number | null;
  tokenId: string;
  recipientAddress: string;
  recipientFid: number | null;
  txHash: string | null;
  metadata: any;
  createdAt: string;
}

export default function NFTsPage() {
  const { isSDKLoaded } = useMiniApp();
  const [mints, setMints] = useState<Mint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  useEffect(() => {
    async function fetchMints() {
      try {
        setLoading(true);
        const response = await fetch("/api/studio/nfts");
        if (!response.ok) {
          throw new Error("Failed to fetch NFTs");
        }
        const data = await response.json();
        setMints(data.mints || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load NFTs");
      } finally {
        setLoading(false);
      }
    }

    fetchMints();
  }, []);

  return (
    <AuthWrapper>
      <MobileLayout
        title="My NFTs"
        headerActions={
          <Link
            href="/studio/nfts/create"
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            Create NFT
          </Link>
        }
      >
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          ) : mints.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No NFTs yet
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Create your first NFT to get started
              </p>
              <Link
                href="/studio/nfts/create"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                <Plus className="h-4 w-4" />
                Create NFT
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {mints.map((mint) => (
                <div
                  key={mint.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Token #{mint.tokenId}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        Recipient: {mint.recipientAddress}
                      </p>
                      {mint.metadata && typeof mint.metadata === 'object' && mint.metadata.tokenURI && (
                        <a
                          href={mint.metadata.tokenURI}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mb-2 block"
                        >
                          View Metadata
                        </a>
                      )}
                      {mint.txHash && (
                        <a
                          href={`https://basescan.org/tx/${mint.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 hover:underline"
                        >
                          View Transaction
                        </a>
                      )}
                    </div>
                    {mint.collectionId && (
                      <a
                        href={`https://basescan.org/token/${mint.tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 p-2 text-gray-400 hover:text-gray-600"
                      >
                        <ExternalLink className="h-5 w-5" />
                      </a>
                    )}
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

