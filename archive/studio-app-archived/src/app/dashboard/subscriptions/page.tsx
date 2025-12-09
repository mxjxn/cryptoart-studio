"use client";

import { useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { SubscriptionList } from "~/components/ui/dashboard/SubscriptionList";
import { Users } from "lucide-react";
import { AuthWrapper } from "~/components/AuthWrapper";

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

export default function SubscriptionsPage() {
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
        title="Subscriptions"
      >
        <div className="space-y-4">
          {/* Header Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <Users className="h-6 w-6 text-blue-600 mr-3" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Your Subscriptions
                </h1>
                <p className="text-gray-600 mt-1 text-sm">
                  Manage your Hypersub contracts and analyze your subscriber data.
                </p>
              </div>
            </div>
          </div>

          {/* Subscriptions Section */}
          <SubscriptionList fid={context?.user?.fid || 0} />
        </div>
      </MobileLayout>
    </AuthWrapper>
  );
}
