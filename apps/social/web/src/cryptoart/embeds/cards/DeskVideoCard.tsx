import type { DeskVideoEmbed } from '../types';

export function DeskVideoCard({ video }: { video: DeskVideoEmbed }) {
  const poster = video.thumbnailUrl;
  return <div className="overflow-hidden rounded-md border border-[#2a2a2a] bg-black">
  {/* Desk player keeps a static poster; full in-feed controls ship with PR 208 media work. */}
    <video className="max-h-[280px] w-full bg-black" controls playsInline poster={poster} preload="metadata" src={video.url} />
  </div>;
}