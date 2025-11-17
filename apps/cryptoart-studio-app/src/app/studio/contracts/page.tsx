"use client";

import { useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { AuthWrapper } from "~/components/AuthWrapper";
import Link from "next/link";
import { FileCode, Plus, ExternalLink } from "lucide-react";

export default function ContractsPage() {
  const { context, isSDKLoaded } = useMiniApp();

  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  // TODO: Fetch contracts from API/subgraph
  const contracts: Array<{
    address: string;
    name: string;
    symbol: string;
    type: "ERC721" | "ERC1155" | "ERC6551";
    network: string;
    createdAt: string;
  }> = [];

  return (
    <AuthWrapper>
      <MobileLayout title="My Contracts">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">
              Contracts
            </h1>
            <Link
              href="/studio/contracts/new"
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Link>
          </div>

          {/* Contracts List */}
          {contracts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <FileCode className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No contracts yet
              </h3>
              <p className="text-gray-600 mb-4">
                Create your first NFT contract to get started.
              </p>
              <Link
                href="/studio/contracts/new"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Contract
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {contracts.map((contract) => (
                <div
                  key={contract.address}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="text-base font-semibold text-gray-900 mr-2">
                          {contract.name}
                        </h3>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                          {contract.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {contract.symbol} • {contract.network}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">
                        {contract.address.slice(0, 6)}...
                        {contract.address.slice(-4)}
                      </p>
                    </div>
                    <a
                      href={`https://basescan.org/address/${contract.address}`}
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

