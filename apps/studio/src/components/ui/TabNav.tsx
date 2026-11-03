'use client';

import { cn } from '~/lib/utils';

interface TabNavProps<T extends string> {
  tabs: { id: T; label: string }[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  className?: string;
}

export function TabNav<T extends string>({ tabs, activeTab, onTabChange, className }: TabNavProps<T>) {
  return (
    <div className={cn('flex border-b border-border', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'relative px-4 py-4 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'text-foreground'
              : 'text-muted hover:text-foreground',
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-foreground" />
          )}
        </button>
      ))}
    </div>
  );
}
