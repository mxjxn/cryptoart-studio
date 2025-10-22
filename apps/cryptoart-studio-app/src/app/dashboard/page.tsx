"use client";

import { useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { DashboardLayout } from "~/components/ui/dashboard/DashboardLayout";
import { SubscriptionList } from "~/components/ui/dashboard/SubscriptionList";
import { AlertCircle, Users } from "lucide-react";

export default function DashboardPage() {
  const { context, isSDKLoaded } = useMiniApp();

  // Call ready() when SDK is loaded
  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  // Show loading state while SDK loads
  if (!isSDKLoaded) {
    return (
      <DashboardLayout title="Creator Studio Dashboard">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Check if user is authenticated
  if (!context?.user?.fid) {
    return (
      <DashboardLayout title="Creator Studio Dashboard">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
          <p className="text-gray-500 mb-4">
            Please sign in to access the Creator Studio Dashboard.
          </p>
          <a 
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Go to App
          </a>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Creator Studio Dashboard"
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Subscriptions' }
      ]}
    >
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Welcome to Creator Studio
              </h1>
              <p className="text-gray-600 mt-1">
                Manage your Hypersub contracts and analyze your subscriber data.
              </p>
            </div>
          </div>
        </div>

        {/* Subscriptions Section */}
        <SubscriptionList fid={context.user.fid} />
      </div>
    </DashboardLayout>
  );
}
