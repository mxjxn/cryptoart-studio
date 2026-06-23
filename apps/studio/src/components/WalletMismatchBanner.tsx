'use client';

import { useActiveWallet } from '~/hooks/useActiveWallet';
import { addressesMatch, truncateAddress } from '~/lib/format';
import { cn } from '~/lib/utils';

interface WalletMismatchBannerProps {
  ownerAddress: string;
  className?: string;
}

export function WalletMismatchBanner({ ownerAddress, className }: WalletMismatchBannerProps) {
  const { address, isConnected } = useActiveWallet();

  if (!isConnected || !address) return null;
  if (addressesMatch(address, ownerAddress)) return null;

  return (
    <div
      className={cn(
        'rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950',
        className,
      )}
      role="alert"
    >
      Connected wallet ({truncateAddress(address)}) does not own this collection. Connect{' '}
      {truncateAddress(ownerAddress)} to manage or mint.
    </div>
  );
}
