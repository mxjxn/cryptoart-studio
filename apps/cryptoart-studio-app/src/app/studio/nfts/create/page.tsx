"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { AuthWrapper } from "~/components/AuthWrapper";
import { NFTMinter } from "~/components/studio/NFTMinter";

export default function CreateNFTPage() {
  const { context, isSDKLoaded } = useMiniApp();
  const searchParams = useSearchParams();
  const type = searchParams.get("type") || "1of1";

  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  return (
    <AuthWrapper>
      <MobileLayout title="Create NFT">
        <NFTMinter initialType={type as "1of1" | "series" | "edition"} />
      </MobileLayout>
    </AuthWrapper>
  );
}

