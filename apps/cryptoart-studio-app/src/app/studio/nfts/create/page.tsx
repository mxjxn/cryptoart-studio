"use client";

import { useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { AuthWrapper } from "~/components/AuthWrapper";
import { NFTMinter } from "~/components/studio/NFTMinter";

export default function CreateNFTPage() {
  const { isSDKLoaded } = useMiniApp();

  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  return (
    <AuthWrapper>
      <MobileLayout title="Create NFT">
        <NFTMinter />
      </MobileLayout>
    </AuthWrapper>
  );
}

