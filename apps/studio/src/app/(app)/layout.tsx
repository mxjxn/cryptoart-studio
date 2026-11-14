'use client';

import Link from 'next/link';
import { ThemeToggle } from '~/components/ThemeToggle';
import { WalletPill } from '~/components/ui/WalletPill';
import { useActiveWallet } from '~/hooks/useActiveWallet';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chainName } = useActiveWallet();

  return (
    <>
      <header className="flex h-[87px] items-center justify-between border-b border-border px-6 md:px-12">
        <Link href="/" className="font-display text-xl tracking-tight text-foreground">
          cryptoart.studio
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/media" className="hidden text-sm text-muted transition-colors hover:text-foreground sm:inline">
            Media
          </Link>
          <ThemeToggle />
          {isConnected && address && <WalletPill address={address} chainName={chainName} />}
        </div>
      </header>
      {isConnected && (
        <div className="flex h-[35px] items-center gap-2 border-b border-border px-6 md:px-12">
          <span className="text-[13px] text-muted">This wallet will sign transactions</span>
        </div>
      )}
      <main className="flex-1">{children}</main>
    </>
  );
}
