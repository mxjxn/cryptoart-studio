'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { cn } from '~/lib/utils';

export function ConnectWalletButton({ className }: { className?: string }) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) {
          return (
            <button type="button" className={cn('studio-btn text-sm opacity-50', className)} disabled>
              Connect wallet
            </button>
          );
        }

        if (!connected) {
          return (
            <button type="button" onClick={openConnectModal} className={cn('studio-btn text-sm', className)}>
              Connect wallet
            </button>
          );
        }

        return (
          <div className={cn('flex items-center gap-2', className)}>
            <button
              type="button"
              onClick={openChainModal}
              className="studio-btn-outline hidden text-sm sm:inline-flex"
            >
              {chain.name}
            </button>
            <button type="button" onClick={openAccountModal} className="studio-btn-outline text-sm font-mono">
              {account.displayName}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
