import { useMemo, useRef, useState } from 'react';

export function InlineAudioCard({
  title,
  artist,
  coverUrl,
  audioUrl,
  href,
}: {
  title: string;
  artist?: string | null;
  coverUrl?: string | null;
  audioUrl?: string | null;
  href: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const label = useMemo(() => artist ? `${title} · ${artist}` : title, [artist, title]);

  if (!audioUrl) {
    return <a href={href} className="block rounded-md border border-[#2a2a2a] px-3 py-3 text-sm hover:border-[#444]">{label}</a>;
  }

  return <article className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-3">
    <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-3">
      {coverUrl
        ? <img src={coverUrl} alt="" className="size-14 rounded object-cover bg-[#222]" />
        : <span className="size-14 rounded bg-[#222]" aria-hidden="true" />}
      <div className="min-w-0">
        <a href={href} className="block truncate text-[14px] font-medium hover:underline">{title}</a>
        {artist && <p className="truncate text-[12px] text-[#888]">{artist}</p>}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-full bg-[#f4f4f4] text-[#111]"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => {
              const audio = audioRef.current;
              if (!audio) return;
              if (audio.paused) {
                void audio.play();
                setPlaying(true);
              } else {
                audio.pause();
                setPlaying(false);
              }
            }}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <input
            type="range"
            min={0}
            max={1000}
            value={progress}
            className="w-full accent-[#dcf54c]"
            aria-label="Playback position"
            onChange={(event) => {
              const audio = audioRef.current;
              if (!audio || !Number.isFinite(audio.duration)) return;
              const next = Number(event.target.value);
              setProgress(next);
              audio.currentTime = (next / 1000) * audio.duration;
            }}
          />
        </div>
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onTimeUpdate={() => {
            const audio = audioRef.current;
            if (!audio || !Number.isFinite(audio.duration)) return;
            setProgress(Math.floor((audio.currentTime / audio.duration) * 1000));
          }}
          onEnded={() => setPlaying(false)}
        />
      </div>
    </div>
  </article>;
}