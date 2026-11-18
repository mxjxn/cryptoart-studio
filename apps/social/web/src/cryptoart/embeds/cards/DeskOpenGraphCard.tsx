import type { DeskUrlEmbed } from '../types';

export function DeskOpenGraphCard({ urlEmbed }: { urlEmbed: DeskUrlEmbed }) {
  const og = urlEmbed.openGraph;
  return <a href={og.url} className="block overflow-hidden rounded-md border border-[#2a2a2a] bg-[#141414] hover:border-[#444]" rel="noreferrer" target="_blank">
    {og.image && <img src={og.image} alt="" className="max-h-[200px] w-full object-cover" />}
    <div className="space-y-0.5 px-2.5 py-2">
      {og.title && <p className="line-clamp-2 text-[13px] font-medium text-[#f0f0f0]">{og.title}</p>}
      {og.description && <p className="line-clamp-2 text-[11px] leading-4 text-[#888]">{og.description}</p>}
      <p className="cryptoart-mono truncate text-[10px] uppercase tracking-[0.08em] text-[#666]">
        {(() => { try { return new URL(og.url).hostname.replace(/^www\./, ''); } catch { return 'Link'; } })()}
      </p>
    </div>
  </a>;
}