import type { DeskTokenEmbed } from '../types';

export function DeskTokenCard({ token }: { token: DeskTokenEmbed }) {
  const meta = [token.chainId ? `Chain ${token.chainId}` : null, token.contractAddress?.slice(0, 8)].filter(Boolean).join(' · ');
  return <a href={token.href.startsWith('chain://') ? `https://dexscreener.com/search?q=${encodeURIComponent(token.contractAddress ?? '')}` : token.href}
    className="flex items-center justify-between gap-2 rounded-md border border-[#2a2a2a] bg-[#141414] px-2.5 py-2 hover:border-[#444]"
    rel="noreferrer"
    target="_blank">
    <div className="min-w-0">
      <p className="truncate text-[13px] font-medium text-[#f0f0f0]">{token.label}</p>
      {meta && <p className="cryptoart-mono mt-0.5 truncate text-[10px] uppercase tracking-[0.08em] text-[#666]">{meta}</p>}
    </div>
    <span className="cryptoart-mono shrink-0 text-[10px] text-[#dcf54c]">Token</span>
  </a>;
}