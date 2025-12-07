import { createConfig, http, WagmiProvider, useConnect, useAccount } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { farcasterFrame } from "@farcaster/miniapp-wagmi-connector";
import { configureFabricSDK } from '@withfabric/protocol-sdks';
import { APP_NAME, APP_ICON_URL, APP_URL } from "~/lib/constants";
import React, { useEffect, useState } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  rainbowWallet,
  coinbaseWallet,
  metaMaskWallet,
  walletConnectWallet,
  phantomWallet,
} from '@rainbow-me/rainbowkit/wallets';

// WalletConnect Project ID - required for WalletConnect-based wallets
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// Create connectors with RainbowKit wallets + farcasterFrame for mini-app
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [
        rainbowWallet,
        coinbaseWallet,
        metaMaskWallet,
        walletConnectWallet,
        phantomWallet,
      ],
    },
  ],
  {
    appName: APP_NAME,
    projectId: WALLETCONNECT_PROJECT_ID,
  }
);

// Create wagmi config with RainbowKit wallets + farcasterFrame connector
export const config = createConfig({
  chains: [base, mainnet],
  connectors: [
    ...connectors,
    farcasterFrame(), // Add farcasterFrame for mini-app auto-connect
  ],
  transports: {
    [base.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL || 
      process.env.NEXT_PUBLIC_BASE_RPC_URL || 
      'https://mainnet.base.org'
    ),
    [mainnet.id]: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://eth.llamarpc.com'),
  },
});

// Configure Fabric SDK with wagmi config
configureFabricSDK({ wagmiConfig: config });

const queryClient = new QueryClient();

/**
 * Component that auto-connects the Farcaster wallet when in mini-app context.
 * This ensures users don't need to manually connect their wallet in mini-apps.
 */
function MiniAppAutoConnect({ children }: { children: React.ReactNode }) {
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();
  const [hasAttemptedConnect, setHasAttemptedConnect] = useState(false);

  useEffect(() => {
    // Only attempt once per mount to avoid loops
    if (hasAttemptedConnect || isConnected) return;

    async function autoConnect() {
      try {
        const isMiniApp = await sdk.isInMiniApp();
        if (isMiniApp) {
          // Find the farcasterFrame connector
          const farcasterConnector = connectors.find(
            (c) => c.id === 'farcasterMiniApp' || c.name === 'Farcaster Frame'
          );
          
          if (farcasterConnector) {
            console.log('[MiniAppAutoConnect] Auto-connecting Farcaster wallet in mini-app context');
            connect({ connector: farcasterConnector });
          }
        }
      } catch (error) {
        console.error('[MiniAppAutoConnect] Error during auto-connect:', error);
      } finally {
        setHasAttemptedConnect(true);
      }
    }

    autoConnect();
  }, [connect, connectors, isConnected, hasAttemptedConnect]);

  return <>{children}</>;
}

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <MiniAppAutoConnect>
          {children}
        </MiniAppAutoConnect>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

