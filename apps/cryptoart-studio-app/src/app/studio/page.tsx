"use client";

import { useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import Link from "next/link";
import { Image, Plus } from "lucide-react";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { AuthWrapper } from "~/components/AuthWrapper";
import { CurrentAuctions } from "~/components/studio/CurrentAuctions";
import { CollectionsList } from "~/components/studio/CollectionsList";

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

export default function StudioPage() {
  const { isSDKLoaded } = useMiniApp();

  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  return (
    <AuthWrapper>
      <MobileLayout title="Creator Studio" showBottomNav={false}>
        <div className="space-y-6">
          {/* Quick Action */}
          <div className="flex justify-end">
            <Link
              href="/studio/nfts/create"
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create NFT
            </Link>
          </div>

          {/* Current Auctions Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <CurrentAuctions />
          </div>

          {/* Collections Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <CollectionsList />
          </div>
        </div>
      </MobileLayout>
    </AuthWrapper>
  );
}

