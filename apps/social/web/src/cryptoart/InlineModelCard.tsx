export function InlineModelCard({
  title,
  creator,
  coverUrl,
  playerUrl,
  modelUrl,
  href,
}: {
  title: string;
  creator?: string | null;
  coverUrl?: string | null;
  playerUrl?: string | null;
  modelUrl?: string | null;
  href: string;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#0d0d0d]">
      <motionHolder playerUrl={playerUrl} coverUrl={coverUrl} title={title} />
      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[#f0f0f0]">{title}</p>
          {creator && <p className="truncate text-[12px] text-[#888]">{creator}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-[#888]">
          {modelUrl && (
            <a className="underline hover:text-white" href={modelUrl} target="_blank" rel="noreferrer">Model</a>
          )}
          <a className="underline hover:text-white" href={href}>Studio</a>
        </div>
      </div>
    </article>
  );
}

function motionHolder({
  playerUrl,
  coverUrl,
  title,
}: {
  playerUrl?: string | null;
  coverUrl?: string | null;
  title: string;
}) {
  if (playerUrl) {
    return (
      <iframe
        title={title}
        src={playerUrl}
        className="block h-[220px] w-full border-0 bg-[#e8e8ea]"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }
  if (coverUrl) {
    return <img src={coverUrl} alt="" className="block h-[180px] w-full object-cover" />;
  }
  return <div className="h-[180px] w-full bg-[#1a1a1a]" aria-hidden />;
}