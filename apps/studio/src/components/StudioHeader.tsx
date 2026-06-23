import Link from 'next/link';
import { APP_NAME } from '~/lib/constants';

export function StudioHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          {APP_NAME}
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/dashboard" className="studio-btn-outline text-sm">
            Dashboard
          </Link>
          <Link href="/dashboard" className="studio-btn text-sm">
            Connect wallet
          </Link>
        </nav>
      </div>
    </header>
  );
}
