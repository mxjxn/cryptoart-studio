"use client";

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

import { useEffect, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  Plus,
  ExternalLink,
  Loader2,
  LayoutGrid,
  List,
  Image as ImageIcon,
} from "lucide-react";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { AuthWrapper } from "~/components/AuthWrapper";

interface Collection {
  id: string;
  address: string;
  name: string | null;
  symbol: string | null;
  contractType: string;
  chainId: number;
  metadata: any;
  defaultImage: string | null;
  createdAt: string;
}

interface NFT {
  id: string;
  tokenId: string;
  image: string | null;
  name: string;
  description: string | null;
  ownerStatus: string;
  createdAt: string;
}

type ViewMode = "grid" | "list";

export default function CollectionDetailPage() {
  const { isSDKLoaded } = useMiniApp();
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;

  const [collection, setCollection] = useState<Collection | null>(null);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  useEffect(() => {
    async function fetchCollection() {
      try {
        setLoading(true);
        const response = await fetch(`/api/studio/collections/${address}`);
        if (!response.ok) {
          throw new Error("Failed to fetch collection");
        }
        const data = await response.json();
        setCollection(data.collection);
        setNfts(data.nfts || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load collection");
      } finally {
        setLoading(false);
      }
    }

    if (address) {
      fetchCollection();
    }
  }, [address]);

  const getOwnerStatusBadge = (status: string) => {
    const colors = {
      you: "bg-green-100 text-green-800",
      "on auction": "bg-blue-100 text-blue-800",
      "for sale": "bg-purple-100 text-purple-800",
      "in pool": "bg-orange-100 text-orange-800",
    };
    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <AuthWrapper>
        <MobileLayout title="Collection" showBackButton backHref="/studio">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </MobileLayout>
      </AuthWrapper>
    );
  }

  if (error || !collection) {
    return (
      <AuthWrapper>
        <MobileLayout title="Collection" showBackButton backHref="/studio">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error || "Collection not found"}</p>
          </div>
        </MobileLayout>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <MobileLayout
        title={collection.name || "Collection"}
        showBackButton
        backHref="/studio"
        breadcrumbs={[
          { label: "Studio", href: "/studio" },
          { label: "Collections", href: "/studio" },
          { label: collection.name || "Collection" }
        ]}
      >
        <div className="space-y-6">
          {/* Compact Collection Details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-start gap-4">
              {collection.defaultImage ? (
                <img
                  src={collection.defaultImage}
                  alt={collection.name || "Collection"}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Package className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">
                    {collection.name || "Unnamed Collection"}
                  </h2>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium flex-shrink-0">
                    {collection.contractType}
                  </span>
                </div>
                {collection.symbol && (
                  <p className="text-sm text-gray-600 mb-1">{collection.symbol}</p>
                )}
                <p className="text-xs text-gray-500 font-mono truncate">
                  {collection.address}
                </p>
                <p className="text-xs text-gray-500">Chain ID: {collection.chainId}</p>
              </div>
              <a
                href={`https://basescan.org/address/${collection.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <ExternalLink className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* NFTs Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">NFTs</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded ${
                    viewMode === "grid"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded ${
                    viewMode === "list"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            {nfts.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No items yet
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Create your first NFT in this collection
                </p>
                <div className="flex gap-3 justify-center">
                  <Link
                    href={`/studio/nfts/create?collection=${address}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4" />
                    Create New Item
                  </Link>
                  <Link
                    href={`/studio/nfts/create?collection=${address}&type=series`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Create a Series
                  </Link>
                </div>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {nfts.map((nft) => (
                  <div
                    key={nft.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      // TODO: Navigate to NFT detail page
                      console.log("Navigate to NFT:", nft.tokenId);
                    }}
                  >
                    <div className="aspect-square bg-gray-100 relative">
                      {nft.image ? (
                        <img
                          src={nft.image}
                          alt={nft.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h4 className="text-sm font-semibold text-gray-900 truncate mb-1">
                        {nft.name}
                      </h4>
                      <p className="text-xs text-gray-500 mb-2">#{nft.tokenId}</p>
                      {getOwnerStatusBadge(nft.ownerStatus)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Image
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Token ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Owner
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {nfts.map((nft) => (
                      <tr
                        key={nft.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          // TODO: Navigate to NFT detail page
                          console.log("Navigate to NFT:", nft.tokenId);
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="w-12 h-12 rounded overflow-hidden bg-gray-100">
                            {nft.image ? (
                              <img
                                src={nft.image}
                                alt={nft.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{nft.name}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">#{nft.tokenId}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                          {nft.description || "-"}
                        </td>
                        <td className="px-4 py-3">{getOwnerStatusBadge(nft.ownerStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </MobileLayout>
    </AuthWrapper>
  );
}

