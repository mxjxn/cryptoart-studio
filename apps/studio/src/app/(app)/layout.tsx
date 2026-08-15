'use client';

import Link from 'next/link';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import { WalletPill } from '~/components/ui/WalletPill';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chainName } = useActiveWallet();

  return (
    <>
      <header className="flex h-[87px] items-center justify-between border-b border-border px-12">
        <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
          cryptoart.studio
        </Link>
        {isConnected && address && (
          <WalletPill address={address} chainName={chainName} />
        )}
      </header>
      {isConnected && (
        <div className="flex h-[35px] items-center gap-2 border-b border-border px-12">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
            <path d="M19 7V4a1 1 0 00-1-1H5a2 2 0 00-2 2v14a2 2 0 002 2h13a1 1 0 001-1v-3" />
            <path d="M21 12a2 2 0 00-2-2h-5a2 2 0 00-2 2v0a2 2 0 002 2h5a2 2 0 002-2z" />
          </svg>
          <span className="text-[13px] text-muted">This wallet will sign transactions</span>
        </div>
      )}
      <main className="flex-1">{children}</main>
    </>
  );
}
