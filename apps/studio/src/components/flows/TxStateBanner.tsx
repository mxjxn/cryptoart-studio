'use client';

import { cn } from '~/lib/utils';
import type { TxPhase } from '~/components/flows/types';

const COPY: Record<
  Exclude<TxPhase, 'idle' | 'validating'>,
  { title: string; tone: 'neutral' | 'warn' | 'danger' | 'success' | 'accent' }
> = {
  wallet_missing: {
    title: 'Connect a wallet to continue',
    tone: 'warn',
  },
  wrong_chain: {
    title: 'Wrong network',
    tone: 'warn',
  },
  awaiting_signature: {
    title: 'Confirm in your wallet…',
    tone: 'accent',
  },
  pending: {
    title: 'Transaction pending',
    tone: 'accent',
  },
  confirmed: {
    title: 'Confirmed on-chain',
    tone: 'success',
  },
  failed: {
    title: 'Transaction failed',
    tone: 'danger',
  },
  insufficient_funds: {
    title: 'Insufficient funds for gas or payment',
    tone: 'danger',
  },
  empty: {
    title: 'Nothing here yet',
    tone: 'neutral',
  },
};

const TONE_CLASS = {
  neutral: 'border-border bg-background-sunken text-muted',
  warn: 'border-warning/30 bg-warning-faint text-warning',
  danger: 'border-error/30 bg-error-faint text-error',
  success: 'border-success/30 bg-success-faint text-success',
  accent: 'border-accent/30 bg-accent-faint text-accent',
} as const;

export function TxStateBanner({
  phase,
  message,
  className,
}: {
  phase: TxPhase;
  message?: string;
  className?: string;
}) {
  if (phase === 'idle' || phase === 'validating') return null;
  const meta = COPY[phase];
  return (
    <div
      role="status"
      className={cn(
        'gallery-fade-up rounded-md border px-4 py-3 text-sm',
        TONE_CLASS[meta.tone],
        className,
      )}
    >
      <p className="font-medium">{meta.title}</p>
      {message && <p className="mt-1 opacity-90">{message}</p>}
    </div>
  );
}
