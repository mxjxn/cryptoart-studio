'use client';

import Link from 'next/link';
import { ConnectWalletButton } from '~/components/ConnectWalletButton';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="flex h-20 items-center justify-between border-b border-border px-12">
        <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
          cryptoart.studio
        </Link>
        <div className="flex items-center gap-4">
          <ConnectWalletButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}
