"use client";

import { useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import Link from "next/link";
import { FileCode, Image, Package, ArrowRight } from "lucide-react";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { AuthWrapper } from "~/components/AuthWrapper";

export default function StudioPage() {
  const { isSDKLoaded } = useMiniApp();

  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  return (
    <AuthWrapper>
      <MobileLayout title="Creator Studio">
        <div className="space-y-4">
          {/* Welcome Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Creator Studio
            </h1>
            <p className="text-gray-600 text-sm">
              Deploy contracts, create NFTs, and manage your collections.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-4">
            {/* Contract Creation */}
            <Link
              href="/studio/contracts/new"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-blue-100 rounded-lg p-3 mr-4">
                    <FileCode className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Deploy Contract
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Create a new ERC721, ERC1155, or ERC6551 contract
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </Link>

            {/* NFT Creation */}
            <Link
              href="/studio/nfts/create"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-green-500 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-green-100 rounded-lg p-3 mr-4">
                    <Image className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Create NFT
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Mint 1/1s, series, or editions
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </Link>

            {/* View Contracts */}
            <Link
              href="/studio/contracts"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-purple-500 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-purple-100 rounded-lg p-3 mr-4">
                    <Package className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      My Contracts
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      View and manage your deployed contracts
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </Link>

            {/* View NFTs */}
            <Link
              href="/studio/nfts"
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-orange-500 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-orange-100 rounded-lg p-3 mr-4">
                    <Image className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      My NFTs
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      View and manage your minted NFTs
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </Link>
          </div>
        </div>
      </MobileLayout>
    </AuthWrapper>
  );
}

