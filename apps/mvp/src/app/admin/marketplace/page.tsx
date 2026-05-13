"use client";

import { HomepageLayoutManager } from '../HomepageLayoutManager';

export default function AdminMarketplacePage() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Marketplace Layout</h2>
      {/* Reuse the HomepageLayoutManager but default to the market surface */}
      <HomepageLayoutManager initialSurface="market" />
    </div>
  );
}
