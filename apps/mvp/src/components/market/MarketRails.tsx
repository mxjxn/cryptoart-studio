'use client';

import dynamic from 'next/dynamic';

// Client-side wrapper to avoid server-side blocking on subgraph or enrichment
const MarketRailsClient = dynamic(() => import('./MarketRailsClient'), { ssr: false });

export default function MarketRails() {
  return <MarketRailsClient />;
}
