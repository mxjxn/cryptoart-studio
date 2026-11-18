import type { DeskStubKind } from '../types';

const COPY: Record<DeskStubKind, string> = {
  'gallery': 'Studio gallery embed',
  'studio-collection': 'Studio collection embed',
  'burn-to-mint': 'Burn-to-mint embed',
  'lssvm-pool': 'LSSVM pool embed',
};

export function DeskStubCard({ stub, href }: { stub: DeskStubKind; href: string }) {
  return <div className="rounded-md border border-dashed border-[#3a3a3a] bg-[#101010] px-3 py-2 text-[12px] text-[#888]">
    <p className="cryptoart-mono text-[10px] uppercase tracking-[0.08em] text-[#555]">Coming soon</p>
    <p className="mt-1 text-[#aaa]">{COPY[stub]}</p>
    <a href={href} className="mt-1 inline-block truncate text-[#dcf54c] hover:underline" rel="noreferrer" target="_blank">{href}</a>
  </div>;
}