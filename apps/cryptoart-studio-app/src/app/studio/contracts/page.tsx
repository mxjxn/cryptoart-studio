"use client";

import { useEffect, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import Link from "next/link";
import { Package, Plus, ExternalLink, Loader2 } from "lucide-react";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { AuthWrapper } from "~/components/AuthWrapper";

interface Collection {
  id: string;
  address: string;
  name: string | null;
  symbol: string | null;
  contractType: string;
  chainId: number;
  createdAt: string;
}

export default function ContractsPage() {
  const { isSDKLoaded } = useMiniApp();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  useEffect(() => {
    async function fetchCollections() {
      try {
        setLoading(true);
        const response = await fetch("/api/studio/contracts");
        if (!response.ok) {
          throw new Error("Failed to fetch collections");
        }
        const data = await response.json();
        setCollections(data.collections || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load collections");
      } finally {
        setLoading(false);
      }
    }

    fetchCollections();
  }, []);

  return (
    <AuthWrapper>
      <MobileLayout
        title="My Contracts"
        headerActions={
          <Link
            href="/studio/contracts/new"
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Deploy New
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
          ) : collections.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No contracts yet
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Deploy your first contract to get started
              </p>
              <Link
                href="/studio/contracts/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Deploy Contract
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {collections.map((collection) => (
                <div
                  key={collection.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {collection.name || "Unnamed Collection"}
                        </h3>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                          {collection.contractType}
                        </span>
                      </div>
                      {collection.symbol && (
                        <p className="text-sm text-gray-600 mb-2">
                          {collection.symbol}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 font-mono mb-2">
                        {collection.address}
                      </p>
                      <p className="text-xs text-gray-500">
                        Chain ID: {collection.chainId}
                      </p>
                    </div>
                    <a
                      href={`https://basescan.org/address/${collection.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 p-2 text-gray-400 hover:text-gray-600"
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

