"use client";

import { AuthWrapper } from "~/components/AuthWrapper";
import { Header } from "~/components/ui/Header";
import { useNeynarUser } from "~/hooks/useNeynarUser";
import { useMiniApp } from "@neynar/react";
import { LandingPage } from "./LandingPage";

export default function LandingPageWrapper() {
  const { context } = useMiniApp();
  const { user: neynarUser } = useNeynarUser(context || undefined);

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-background">
        <Header neynarUser={neynarUser} />
        <LandingPage />
      </div>
    </AuthWrapper>
  );
}

