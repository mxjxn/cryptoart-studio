'use client';

import { ConnectWalletButton } from '~/components/ConnectWalletButton';
import { studioChainLabel } from '~/lib/adapters/marketplace';
import { cn } from '~/lib/utils';

export function WalletGate({
  title = 'Connect your wallet',
  description = 'Connect the wallet that owns this collection so you can finish setup in Studio.',
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-6 rounded-md border border-border bg-background-raised px-8 py-10',
        className,
      )}
    >
      <div>
        <h2 className="font-display text-3xl text-foreground">{title}</h2>
        <p className="mt-3 max-w-md text-muted">{description}</p>
      </div>
      <ConnectWalletButton />
    </div>
  );
}

export function WrongChainNotice({
  currentChainId,
  expectedChainId,
  onSwitch,
  className,
}: {
  currentChainId?: number;
  expectedChainId: number;
  onSwitch?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-md border border-warning/30 bg-warning-faint px-6 py-5',
        className,
      )}
    >
      <div>
        <p className="font-medium text-warning">Wrong network</p>
        <p className="mt-1 text-sm text-foreground/80">
          This collection lives on {studioChainLabel(expectedChainId)}.
          {currentChainId != null && (
            <> You’re currently on {studioChainLabel(currentChainId)}.</>
          )}
        </p>
      </div>
      {onSwitch && (
        <button type="button" onClick={onSwitch} className="studio-btn w-fit">
          Switch network
        </button>
      )}
    </div>
  );
}
