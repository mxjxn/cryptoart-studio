'use client';

import Link from 'next/link';
import { ConnectWalletButton } from '~/components/ConnectWalletButton';
import { useActiveWallet } from '~/hooks/useActiveWallet';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { isConnected, address } = useActiveWallet();
  const showStudio = isConnected && !!address;

  return (
    <>
      <header className="flex h-20 items-center justify-between px-16">
        <Link href={showStudio ? '/dashboard' : '/'} className="text-lg font-bold text-foreground">
          cryptoart.studio
        </Link>
        <nav className="flex items-center gap-6">
          {showStudio ? (
            <Link href="/dashboard" className="studio-btn-ghost">
              My Collections
            </Link>
          ) : (
            <Link href="/dashboard" className="studio-btn-ghost">
              Enter studio
            </Link>
          )}
          <ConnectWalletButton />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}
