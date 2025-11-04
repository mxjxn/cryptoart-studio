'use client';

import dynamic from 'next/dynamic';
import { MiniAppProvider } from '@neynar/react';
import { ANALYTICS_ENABLED, RETURN_URL } from '~/lib/constants';

// Lazy load heavy providers
const WagmiProvider = dynamic(
  () => import('~/components/providers/WagmiProvider'),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-screen"><div className="spinner h-8 w-8"></div></div>,
  }
);

const SafeFarcasterSolanaProvider = dynamic(
  () => import('~/components/providers/SafeFarcasterSolanaProvider').then(m => ({ default: m.SafeFarcasterSolanaProvider })),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-screen"><div className="spinner h-8 w-8"></div></div>,
  }
);

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  const solanaEndpoint =
    process.env.SOLANA_RPC_ENDPOINT || 'https://solana-rpc.publicnode.com';
  return (
    <WagmiProvider>
      <MiniAppProvider
        analyticsEnabled={ANALYTICS_ENABLED}
        backButtonEnabled={true}
        returnUrl={RETURN_URL}
      >
        <SafeFarcasterSolanaProvider endpoint={solanaEndpoint}>
          {children}
        </SafeFarcasterSolanaProvider>
      </MiniAppProvider>
    </WagmiProvider>
  );
}
