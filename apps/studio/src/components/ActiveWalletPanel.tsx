'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import { truncateAddress } from '~/lib/format';
import { cn } from '~/lib/utils';

interface ActiveWalletPanelProps {
  className?: string;
  compact?: boolean;
}

export function ActiveWalletPanel({ className, compact = false }: ActiveWalletPanelProps) {
  const {
    address,
    isConnected,
    isConnecting,
    authModeLoading,
    chainName,
    farcasterUsername,
    walletDiffersFromFarcasterPrimary,
    farcasterPrimaryWallet,
  } = useActiveWallet();

  if (authModeLoading || isConnecting) {
    return (
      <div className={cn('studio-card text-sm text-muted', className)}>
        Checking wallet connection…
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className={cn('studio-card', className)}>
        <p className="text-sm font-semibold">Connect to enter the studio</p>
        <p className="mt-2 text-sm text-muted">
          Your connected wallet is used to deploy collections and sign mint transactions.
        </p>
        <div className="mt-4">
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('studio-card', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Signing wallet</p>
          <p className="mt-2 font-mono text-lg font-bold">{truncateAddress(address, 6)}</p>
          <p className="mt-1 text-sm text-muted">
            This wallet will sign all transactions on cryptoart.studio.
          </p>
          <p className="mt-2 text-sm">
            Network: <span className="font-semibold">{chainName}</span>
          </p>
          {farcasterUsername && (
            <p className="mt-1 text-sm text-muted">
              Farcaster: <span className="font-semibold text-foreground">@{farcasterUsername}</span>
            </p>
          )}
        </div>
        {!compact && (
          <div className="shrink-0">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
          </div>
        )}
      </div>

      {walletDiffersFromFarcasterPrimary && farcasterPrimaryWallet && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Connected wallet differs from your Farcaster primary wallet (
          {truncateAddress(farcasterPrimaryWallet)}). Collection management requires the wallet that
          owns the contract.
        </div>
      )}
    </div>
  );
}
