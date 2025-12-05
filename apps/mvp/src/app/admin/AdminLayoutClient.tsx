'use client';

import { useIsAdmin } from '~/hooks/useIsAdmin';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { TransitionLink } from '~/components/TransitionLink';

const ADMIN_TABS = [
  { name: 'Featured', href: '/admin/featured' },
  { name: 'Users', href: '/admin/users' },
  { name: 'Membership', href: '/admin/membership' },
  { name: 'Stats', href: '/admin/stats' },
  { name: 'Errors', href: '/admin/errors' },
  { name: 'Notifications', href: '/admin/notifications' },
];

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useIsAdmin();
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    // Only redirect after loading is complete and user is not admin
    if (!isLoading && !isAdmin) {
      router.replace('/');
    }
  }, [isAdmin, isLoading, router]);
  
  // Show loading state while wallet is connecting
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--color-secondary)]">Loading...</p>
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--color-secondary)]">Unauthorized</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Header */}
      <header className="bg-[var(--color-background)] border-b border-[var(--color-border)] sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[var(--color-text)]">Admin Dashboard</h1>
          <TransitionLink 
            href="/" 
            className="text-sm text-[var(--color-secondary)] hover:text-[var(--color-text)]"
          >
            ← Back to App
          </TransitionLink>
        </div>
        
        {/* Tab Navigation - Horizontal scroll on mobile */}
        <nav className="flex overflow-x-auto px-4 -mb-px scrollbar-hide">
          {ADMIN_TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
            return (
              <TransitionLink
                key={tab.href}
                href={tab.href}
                className={`flex-shrink-0 px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-[var(--color-primary)] text-[var(--color-text)]'
                    : 'border-transparent text-[var(--color-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border)]'
                }`}
              >
                {tab.name}
              </TransitionLink>
            );
          })}
        </nav>
      </header>
      
      {/* Content */}
      <main className="p-4">
        {children}
      </main>
    </div>
  );
}

