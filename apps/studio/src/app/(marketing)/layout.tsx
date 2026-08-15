'use client';

import Link from 'next/link';
import { ConnectWalletButton } from '~/components/ConnectWalletButton';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="flex h-20 items-center justify-between px-16">
        <Link href="/" className="text-lg font-bold text-foreground">
          cryptoart.studio
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/dashboard" className="studio-btn-ghost">
            Sign in with Farcaster
          </Link>
          <ConnectWalletButton />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}
