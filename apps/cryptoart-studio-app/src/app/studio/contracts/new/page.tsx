"use client";

import { useEffect, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { AuthWrapper } from "~/components/AuthWrapper";
import { ContractDeployer } from "~/components/studio/ContractDeployer";

export default function NewContractPage() {
  const { context, isSDKLoaded } = useMiniApp();

  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  return (
    <AuthWrapper>
      <MobileLayout title="Create Contract">
        <ContractDeployer />
      </MobileLayout>
    </AuthWrapper>
  );
}

