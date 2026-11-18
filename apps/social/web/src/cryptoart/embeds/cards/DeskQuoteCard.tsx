import type { DeskQuoteEmbed } from '../types';

export function DeskQuoteCard({ quote }: { quote: DeskQuoteEmbed }) {
  const label = quote.author?.username ? `@${quote.author.username}` : quote.hash.slice(0, 10);
  const href = quote.author?.username
    ? `https://farcaster.xyz/${quote.author.username}/${quote.hash}`
    : `https://farcaster.xyz/~/conversations/${quote.hash}`;
  return <a href={href} className="block rounded-md border border-[#2a2a2a] bg-[#101010] px-2.5 py-2 hover:border-[#444]" rel="noreferrer" target="_blank">
    <p className="cryptoart-mono text-[10px] uppercase tracking-[0.08em] text-[#666]">Quoted cast</p>
    <p className="mt-1 text-[12px] text-[#dcf54c]">{label}</p>
    {quote.text && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] leading-5 text-[#cfcfcf]">{quote.text}</p>}
  </a>;
}