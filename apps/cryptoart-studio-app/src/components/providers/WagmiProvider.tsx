import { createConfig, http, WagmiProvider } from "wagmi";
import { base, degen, mainnet, optimism, unichain, celo } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { farcasterFrame } from "@farcaster/miniapp-wagmi-connector";
import { coinbaseWallet, metaMask } from 'wagmi/connectors';
import { APP_NAME, APP_ICON_URL, APP_URL } from "~/lib/constants";
import { useEffect, useRef } from "react";
import { useConnect, useAccount } from "wagmi";
import React from "react";

/**
 * Intelligent wallet auto-connection hook.
 * Detects context (mini-app vs web3) and auto-connects appropriately.
 * 
 * Note: This hook should only be called inside components that are
 * wrapped by both WagmiProvider and MiniAppProvider.
 */
function useIntelligentWalletAutoConnect() {
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();
  const hasAttemptedRef = useRef(false);
  const connectorsRef = useRef<string[]>([]);

  // Track connector IDs to prevent re-running on array reference changes
  const connectorIds = connectors.map(c => c.id || c.name).join(',');

  useEffect(() => {
    // Don't auto-connect if already connected or already attempted
    if (isConnected || hasAttemptedRef.current) {
      return;
    }

    // Don't run if connectors haven't changed
    if (connectorIds === connectorsRef.current.join(',')) {
      return;
    }

    connectorsRef.current = connectors.map(c => c.id || c.name);

    // Check if we're in a mini-app context by checking window properties
    // This avoids calling useIsMiniApp here (which requires MiniAppProvider)
    const isInMiniApp = typeof window !== "undefined" && (
      !!(window as any).farcaster ||
      !!(window.ethereum as any)?.isFarcaster ||
      !!(window.ethereum as any)?.isFarcasterFrame ||
      window.location.href.includes("farcaster")
    );

    // In mini-app context: try Farcaster Frame connector first
    if (isInMiniApp && connectors.length > 0) {
      const farcasterConnector = connectors.find(
        (c) => c.id === "farcasterFrame" || c.name === "Farcaster Frame"
      );
      if (farcasterConnector && !hasAttemptedRef.current) {
        console.log("Auto-connecting with Farcaster Frame connector (mini-app context)");
        hasAttemptedRef.current = true;
        connect({ connector: farcasterConnector });
        return;
      }
    }

    // In regular web3 context: try Coinbase Wallet if available
    if (!isInMiniApp && typeof window !== "undefined" && !hasAttemptedRef.current) {
      const isInCoinbaseWallet = 
        window.ethereum?.isCoinbaseWallet || 
        window.ethereum?.isCoinbaseWalletExtension ||
        window.ethereum?.isCoinbaseWalletBrowser;
      
      if (isInCoinbaseWallet) {
        const coinbaseConnector = connectors.find(
          (c) => c.id === "coinbaseWallet" || c.name === "Coinbase Wallet"
        );
        if (coinbaseConnector) {
          console.log("Auto-connecting with Coinbase Wallet (web3 context)");
          hasAttemptedRef.current = true;
          connect({ connector: coinbaseConnector });
          return;
        }
      }

      // Try MetaMask if available
      if (window.ethereum?.isMetaMask) {
        const metaMaskConnector = connectors.find(
          (c) => c.id === "metaMask" || c.name === "MetaMask"
        );
        if (metaMaskConnector) {
          console.log("Auto-connecting with MetaMask (web3 context)");
          hasAttemptedRef.current = true;
          connect({ connector: metaMaskConnector });
          return;
        }
      }
    }
  }, [isConnected, connectorIds, connect]);
}

/**
 * Creates wagmi config with intelligent connector selection.
 * In mini-app context: prioritizes Farcaster Frame connector
 * In regular web3 context: uses standard wallet connectors
 */
function createWagmiConfig() {
  const connectors = [
    // Farcaster Frame connector (works in mini-apps)
    // In regular web3, this will gracefully fail and fall back to other connectors
    farcasterFrame(),
    // Standard web3 connectors (work in both contexts)
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
  ];

  return createConfig({
    chains: [base, optimism, mainnet, degen, unichain, celo],
    transports: {
      [base.id]: http(),
      [optimism.id]: http(),
      [mainnet.id]: http(),
      [degen.id]: http(),
      [unichain.id]: http(),
      [celo.id]: http(),
    },
    connectors,
  });
}

export const config = createWagmiConfig();

const queryClient = new QueryClient();

// Wrapper component that provides intelligent wallet auto-connection
// This must be a separate component to ensure hooks are called in the right order
const IntelligentWalletAutoConnect = React.memo(({ children }: { children: React.ReactNode }) => {
  useIntelligentWalletAutoConnect();
  return <>{children}</>;
});

IntelligentWalletAutoConnect.displayName = "IntelligentWalletAutoConnect";

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <IntelligentWalletAutoConnect>
          {children}
        </IntelligentWalletAutoConnect>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
