'use client';

import { useState } from 'react';
import { truncateAddress } from '~/lib/format';
import { cn } from '~/lib/utils';

interface CopyAddressProps {
  address: string;
  chars?: number;
  className?: string;
}

export function CopyAddress({ address, chars = 4, className }: CopyAddressProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn('inline-flex items-center gap-1.5 font-mono text-sm text-muted transition-colors hover:text-foreground', className)}
    >
      {truncateAddress(address, chars)}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        {copied ? (
          <polyline points="20 6 9 17 4 12" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </>
        )}
      </svg>
    </button>
  );
}
