"use client";

import { useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { AuthWrapper } from "~/components/AuthWrapper";
import Link from "next/link";
import { 
  FileCode, 
  Image, 
  Layers, 
  Package,
  ArrowRight,
  Sparkles
} from "lucide-react";

export default function StudioPage() {
  const { context, isSDKLoaded } = useMiniApp();

  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  const actions = [
    {
      title: "Create Contract",
      description: "Deploy a new ERC721, ERC1155, or ERC6551 contract",
      icon: FileCode,
      href: "/studio/contracts/new",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Create 1/1 NFT",
      description: "Mint a unique single-edition NFT",
      icon: Image,
      href: "/studio/nfts/create?type=1of1",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Create Series",
      description: "Upload and mint a series of NFTs from a zip file",
      icon: Layers,
      href: "/studio/nfts/create?type=series",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Create Edition",
      description: "Create a limited or open edition collection",
      icon: Package,
      href: "/studio/nfts/create?type=edition",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <AuthWrapper>
      <MobileLayout title="Creator Studio">
        <div className="space-y-4">
          {/* Welcome Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <Sparkles className="h-6 w-6 text-indigo-600 mr-3" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Creator Studio
                </h1>
                <p className="text-gray-600 mt-1 text-sm">
                  Create and manage your NFT contracts and collections.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <h2 className="text-md font-semibold text-gray-900 px-1">
              Quick Actions
            </h2>
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="block"
                >
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-gray-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <div className={`${action.bgColor} p-2 rounded-lg mr-3`}>
                          <Icon className={`h-5 w-5 ${action.color}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-gray-900">
                            {action.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {action.description}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Navigation Links */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-md font-semibold text-gray-900 mb-3">
              Manage
            </h2>
            <div className="space-y-2">
              <Link
                href="/studio/contracts"
                className="block text-sm text-blue-600 hover:text-blue-700"
              >
                View All Contracts →
              </Link>
              <Link
                href="/studio/nfts"
                className="block text-sm text-blue-600 hover:text-blue-700"
              >
                View All NFTs →
              </Link>
            </div>
          </div>
        </div>
      </MobileLayout>
    </AuthWrapper>
  );
}

