import { createConfig, http, WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { farcasterFrame } from "@farcaster/miniapp-wagmi-connector";
import { coinbaseWallet, metaMask } from 'wagmi/connectors';
import { APP_NAME, APP_ICON_URL, APP_URL } from "~/lib/constants";
import React from "react";

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
  },
  connectors: [
    farcasterFrame(),
    coinbaseWallet({
      appName: APP_NAME,
      appLogoUrl: APP_ICON_URL,
      preference: 'all',
    }),
    metaMask({
      dappMetadata: {
        name: APP_NAME,
        url: APP_URL,
      },
    }),
  ],
});

const queryClient = new QueryClient();

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

