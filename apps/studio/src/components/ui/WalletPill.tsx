'use client';

import { useDisconnect } from 'wagmi';
import { truncateAddress } from '~/lib/format';
import { ChainBadge } from '~/components/ui/ChainBadge';

interface WalletPillProps {
  address: string;
  chainName: string;
}

export function WalletPill({ address, chainName }: WalletPillProps) {
  const { disconnect } = useDisconnect();

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-2">
        <span className="font-mono text-sm">{truncateAddress(address, 4)}</span>
        <ChainBadge chainName={chainName} />
      </div>
      <button
        type="button"
        onClick={() => disconnect()}
        className="flex size-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-foreground hover:text-foreground"
        aria-label="Disconnect wallet"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
}
