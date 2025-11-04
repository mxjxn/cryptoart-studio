"use client";

import { useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { SubscriptionList } from "~/components/ui/dashboard/SubscriptionList";
import { ChannelSearch } from "~/components/ui/ChannelSearch";
import { Users, Search } from "lucide-react";
import { AuthWrapper } from "~/components/AuthWrapper";

export default function DashboardPage() {
  const { context, isSDKLoaded } = useMiniApp();

  // Call ready() when SDK is loaded
  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  return (
    <AuthWrapper>
      <MobileLayout 
        title="Creator Studio Dashboard"
      >
        <div className="space-y-4">
          {/* Welcome Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <Users className="h-6 w-6 text-blue-600 mr-3" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Welcome to Creator Studio
                </h1>
                <p className="text-gray-600 mt-1 text-sm">
                  Manage your Hypersub contracts and analyze your subscriber data.
                </p>
              </div>
            </div>
          </div>

          {/* Channel Search Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center mb-4">
              <Search className="h-6 w-6 text-green-600 mr-3" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Channel Data Search
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  Search and analyze casts from any Farcaster channel with advanced filtering.
                </p>
              </div>
            </div>
            <ChannelSearch />
          </div>

          {/* Subscriptions Section */}
          <SubscriptionList fid={context?.user?.fid || 0} />
        </div>
      </MobileLayout>
    </AuthWrapper>
  );
}
