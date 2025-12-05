"use client";

import dynamic from "next/dynamic";
import { MiniAppProvider } from "@neynar/react";
import { AuthKitProvider } from "@farcaster/auth-kit";
import "@farcaster/auth-kit/styles.css";
import { ANALYTICS_ENABLED, RETURN_URL, APP_URL } from "~/lib/constants";
import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ColorSchemeProvider } from "~/contexts/ColorSchemeContext";
import { NetworkSwitchBanner } from "~/components/NetworkSwitchBanner";

const WagmiProvider = dynamic(
  () => import("~/components/providers/WagmiProvider"),
  {
    ssr: false,
  }
);

// AuthKit configuration for web-based Farcaster sign-in
const authKitConfig = {
  rpcUrl: process.env.NEXT_PUBLIC_OP_RPC_URL || "https://mainnet.optimism.io",
  domain: typeof window !== "undefined" ? window.location.host : "localhost:3000",
  siweUri: APP_URL,
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;
function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <ColorSchemeProvider>
      <WagmiProvider>
        <AuthKitProvider config={authKitConfig}>
          <MiniAppProvider
            analyticsEnabled={ANALYTICS_ENABLED}
            backButtonEnabled={true}
            returnUrl={RETURN_URL}
          >
            <QueryClientProvider client={queryClient}>
              <NetworkSwitchBanner />
              {children}
            </QueryClientProvider>
          </MiniAppProvider>
        </AuthKitProvider>
      </WagmiProvider>
    </ColorSchemeProvider>
  );
}
