"use client";

import { useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useSearchParams } from "next/navigation";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { AuthWrapper } from "~/components/AuthWrapper";
import { NFTMinter } from "~/components/studio/NFTMinter";

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

export default function CreateNFTPage() {
  const { isSDKLoaded } = useMiniApp();
  const searchParams = useSearchParams();
  const collectionAddress = searchParams.get("collection");
  const mintType = searchParams.get("type");

  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  // Build breadcrumbs based on whether collection is specified
  const breadcrumbs = collectionAddress
    ? [
        { label: "Studio", href: "/studio" },
        { label: "Collections", href: "/studio" },
        { label: "Collection", href: `/studio/collections/${collectionAddress}` },
        { label: "Create NFT" }
      ]
    : [
        { label: "Studio", href: "/studio" },
        { label: "Create NFT" }
      ];

  return (
    <AuthWrapper>
      <MobileLayout 
        title="Create NFT" 
        showBackButton 
        backHref={collectionAddress ? `/studio/collections/${collectionAddress}` : "/studio"}
        breadcrumbs={breadcrumbs}
      >
        <NFTMinter
          defaultCollection={collectionAddress || undefined}
          defaultMintType={mintType === "series" ? "series" : undefined}
        />
      </MobileLayout>
    </AuthWrapper>
  );
}

