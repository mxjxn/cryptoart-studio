'use client';

import {
  createConfig,
  createStorage,
  http,
  useAccount,
  useConnect,
  WagmiProvider,
} from 'wagmi';
import { base, mainnet } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { farcasterFrame } from '@farcaster/miniapp-wagmi-connector';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  coinbaseWallet,
  metaMaskWallet,
  phantomWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import sdk from '@farcaster/miniapp-sdk';
import { useEffect, useState, type ReactNode } from 'react';
import { APP_NAME, WALLETCONNECT_PROJECT_ID } from '~/lib/constants';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [
        coinbaseWallet,
        metaMaskWallet,
        rainbowWallet,
        walletConnectWallet,
        phantomWallet,
      ],
    },
  ],
  {
    appName: APP_NAME,
    projectId: WALLETCONNECT_PROJECT_ID,
  },
);

const sessionStorage = createStorage({
  storage:
    typeof window !== 'undefined'
      ? {
          getItem: (key: string) => {
            try {
              return window.sessionStorage.getItem(key);
            } catch {
              return null;
            }
          },
          setItem: (key: string, value: string) => {
            try {
              window.sessionStorage.setItem(key, value);
            } catch {
              // ignore quota errors
            }
          },
          removeItem: (key: string) => {
            try {
              window.sessionStorage.removeItem(key);
            } catch {
              // ignore
            }
          },
        }
      : undefined,
});

export const wagmiConfig = createConfig({
  chains: [base, mainnet],
  connectors: [...connectors, farcasterFrame()],
  transports: {
    [base.id]: http(
      process.env.NEXT_PUBLIC_BASE_RPC_URL ||
        process.env.NEXT_PUBLIC_RPC_URL ||
        'https://mainnet.base.org',
    ),
    [mainnet.id]: http(
      process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://eth.llamarpc.com',
    ),
  },
  ssr: true,
  storage: sessionStorage,
});

const queryClient = new QueryClient();

function MiniAppAutoConnect({ children }: { children: ReactNode }) {
  const { connect, connectors: availableConnectors } = useConnect();
  const { isConnected } = useAccount();
  const [hasAttemptedConnect, setHasAttemptedConnect] = useState(false);

  useEffect(() => {
    if (hasAttemptedConnect || isConnected) return;

    async function autoConnect() {
      try {
        const inMiniApp = await sdk.isInMiniApp();
        if (!inMiniApp) return;

        const farcasterConnector = availableConnectors.find(
          (connector) =>
            connector.id === 'farcasterMiniApp' || connector.name === 'Farcaster Frame',
        );

        if (farcasterConnector) {
          connect({ connector: farcasterConnector });
        }
      } finally {
        setHasAttemptedConnect(true);
      }
    }

    autoConnect();
  }, [availableConnectors, connect, hasAttemptedConnect, isConnected]);

  return <>{children}</>;
}

export default function StudioWagmiProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <MiniAppAutoConnect>{children}</MiniAppAutoConnect>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
