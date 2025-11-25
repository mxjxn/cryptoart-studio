import { createConfig, http, WagmiProvider } from "wagmi";
import { base, baseSepolia, degen, mainnet, optimism, unichain, celo } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { farcasterFrame } from "@farcaster/miniapp-wagmi-connector";
import { coinbaseWallet, metaMask } from 'wagmi/connectors';
import { APP_NAME, APP_ICON_URL, APP_URL } from "~/lib/constants";
import { useEffect, useRef } from "react";
import { useConnect, useAccount } from "wagmi";
import React from "react";
import { useIsMiniApp } from "~/hooks/useIsMiniApp";

/**
 * Intelligent wallet auto-connection hook.
 * Detects context (mini-app vs web3) and auto-connects appropriately.
 */
function useIntelligentWalletAutoConnect() {
  const isMiniApp = useIsMiniApp();
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();
  const hasAttemptedRef = useRef(false);
  const connectorsRef = useRef<string[]>([]);

  // Track connector IDs to detect changes
  const connectorIds = connectors.map(c => c.id).join(',');

  useEffect(() => {
    // Don't auto-connect if already connected or already attempted
    if (isConnected || hasAttemptedRef.current) {
      return;
    }

    // Only attempt once per connector set
    if (connectorsRef.current.join(',') === connectorIds && connectorsRef.current.length > 0) {
      return;
    }
    connectorsRef.current = connectors.map(c => c.id);

    // In mini-app context: try Farcaster Frame connector first
    if (isMiniApp && connectors.length > 0) {
      const farcasterConnector = connectors.find(
        (c) => c.id === "farcasterFrame" || c.name === "Farcaster Frame"
      );
      if (farcasterConnector) {
        try {
          console.log("Auto-connecting with Farcaster Frame connector (mini-app context)");
          connect({ connector: farcasterConnector });
          hasAttemptedRef.current = true;
        } catch (err) {
          console.warn("Auto-connection failed:", err);
        }
        return;
      }
    }

    // In regular web3 context: try Coinbase Wallet if available
    if (!isMiniApp && typeof window !== "undefined") {
      const isInCoinbaseWallet = 
        window.ethereum?.isCoinbaseWallet || 
        window.ethereum?.isCoinbaseWalletExtension ||
        window.ethereum?.isCoinbaseWalletBrowser;
      
      if (isInCoinbaseWallet) {
        const coinbaseConnector = connectors.find(
          (c) => c.id === "coinbaseWallet" || c.name === "Coinbase Wallet"
        );
        if (coinbaseConnector) {
          try {
            console.log("Auto-connecting with Coinbase Wallet (web3 context)");
            connect({ connector: coinbaseConnector });
            hasAttemptedRef.current = true;
          } catch (err) {
            console.warn("Auto-connection failed:", err);
          }
          return;
        }
      }

      // Try MetaMask if available
      if (window.ethereum?.isMetaMask) {
        const metaMaskConnector = connectors.find(
          (c) => c.id === "metaMask" || c.name === "MetaMask"
        );
        if (metaMaskConnector) {
          try {
            console.log("Auto-connecting with MetaMask (web3 context)");
            connect({ connector: metaMaskConnector });
            hasAttemptedRef.current = true;
          } catch (err) {
            console.warn("Auto-connection failed:", err);
          }
          return;
        }
      }
    }
  }, [isMiniApp, isConnected, connectorIds, connect]);
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
    chains: [base, baseSepolia, optimism, mainnet, degen, unichain, celo],
    transports: {
      [base.id]: http(),
      [baseSepolia.id]: http(),
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
function IntelligentWalletAutoConnect({ children }: { children: React.ReactNode }) {
  useIntelligentWalletAutoConnect();
  return <>{children}</>;
}

export default function Provider({ children }: { children: React.ReactNode }): React.ReactElement {
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
