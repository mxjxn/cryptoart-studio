'use client';

import Link from 'next/link';
import { APP_NAME } from '~/lib/constants';
import { ConnectWalletButton } from '~/components/ConnectWalletButton';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import { truncateAddress } from '~/lib/format';

export function StudioHeader() {
  const { address, isConnected, chainName, farcasterUsername, authModeLoading } = useActiveWallet();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight">
          {APP_NAME}
        </Link>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <Link href="/dashboard" className="studio-btn-outline text-sm">
            Dashboard
          </Link>

          {isConnected && address && (
            <div className="hidden rounded-lg border border-border px-3 py-2 text-left md:block">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Signing wallet
              </p>
              <p className="font-mono text-sm font-bold">{truncateAddress(address, 5)}</p>
              <p className="text-xs text-muted">{chainName}</p>
            </div>
          )}

          {farcasterUsername && (
            <span className="text-sm font-semibold text-muted">@{farcasterUsername}</span>
          )}

          {authModeLoading ? (
            <span className="text-sm text-muted">…</span>
          ) : (
            <ConnectWalletButton />
          )}
        </div>
      </div>
    </header>
  );
}
