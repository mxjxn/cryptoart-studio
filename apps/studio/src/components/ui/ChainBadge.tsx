import { cn } from '~/lib/utils';

const CHAIN_CONFIG: Record<string, { label: string; className: string }> = {
  Base: { label: 'Base', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  Ethereum: { label: 'Ethereum', className: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
};

interface ChainBadgeProps {
  chainName: string;
  className?: string;
}

export function ChainBadge({ chainName, className }: ChainBadgeProps) {
  const config = CHAIN_CONFIG[chainName] ?? {
    label: chainName,
    className: 'border-border bg-background text-foreground',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-[13px] font-medium',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
