import type { DeskUrlEmbed } from '../types';

type FramePayload = NonNullable<DeskUrlEmbed['openGraph']['frameEmbedNext']>;

export function DeskFrameCard({ frame }: { frame: FramePayload }) {
  const image = frame.frameEmbed.imageUrl;
  const title = frame.frameEmbed.button.title;
  const name = frame.frameEmbed.button.action.name;
  const href = frame.frameEmbed.button.action.url || frame.frameUrl;
  return <a href={href} className="block overflow-hidden rounded-md border border-[#2a2a2a] bg-[#141414] hover:border-[#dcf54c]/60" rel="noreferrer" target="_blank">
    {image && <img src={image} alt="" className="max-h-[180px] w-full object-cover" />}
    <div className="flex items-center justify-between gap-2 px-2.5 py-2">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-[#f0f0f0]">{name}</p>
        <p className="cryptoart-mono text-[10px] uppercase tracking-[0.08em] text-[#666]">Mini app</p>
      </div>
      <span className="shrink-0 border border-[#dcf54c] px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-[#dcf54c]">{title}</span>
    </div>
  </a>;
}