'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuctionCard } from '~/components/AuctionCard';

const gradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
];

async function fetchMarketLayout() {
  const res = await fetch('/api/market-layout');
  if (!res.ok) throw new Error('Failed to load market layout');
  const data = await res.json();
  return (data.sections ?? []) as any[];
}

export default function MarketRailsClient() {
  const { data: sections = [], isLoading, isError } = useQuery({
    queryKey: ['market-layout'],
    queryFn: fetchMarketLayout,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="mb-6 flex items-center gap-3">
        <div className="w-28 h-16 rounded bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.03)] animate-pulse" />
        <div className="w-28 h-16 rounded bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.03)] animate-pulse" />
        <div className="text-xs text-[var(--color-tertiary)]">Loading market highlights…</div>
      </div>
    );
  }

  if (isError || !sections || sections.length === 0) {
    return (
      <div className="mb-6 flex items-center gap-3">
        <div className="w-28 h-16 rounded bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.03)] animate-pulse" />
        <div className="w-28 h-16 rounded bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.03)] animate-pulse" />
        <div className="text-xs text-[var(--color-tertiary)]">Market highlights unavailable — refresh or check admin.</div>
      </div>
    );
  }

  return (
    <div className="mb-10 space-y-10">
      {sections.map((section: any, si: number) => (
        <section key={section.id} className="border-b border-[#333333] pb-8 last:border-b-0">
          {(section.title || section.sectionType) && (
            <h2 className="mb-1 font-mek-mono text-sm uppercase tracking-[0.5px] text-white">
              {section.title || String(section.sectionType).replace(/_/g, ' ')}
            </h2>
          )}
          {section.description ? (
            <p className="mb-4 text-xs text-[#999999]">{section.description}</p>
          ) : null}
          {!(section.listings && section.listings.length > 0) ? (
            <p className="text-sm text-[#666666]">Nothing in this section yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {section.listings.map((auction: any, i: number) => (
                <AuctionCard
                  key={`${section.id}-${String(auction.listingId)}-${String(auction.chainId ?? '')}`}
                  auction={auction}
                  gradient={gradients[(si + i) % gradients.length]}
                  index={i}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
