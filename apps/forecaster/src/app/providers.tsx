"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { FarcasterConnector } from "@farcaster/miniapp-wagmi-connector";
import { ReactNode, useState } from "react";

export const config = createConfig({
  chains: [base],
  connectors: [
    injected(),
    new FarcasterConnector({
      rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://mainnet.base.org",
    }),
  ],
  transports: {
    [base.id]: http(),
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
