export default function MarketLoading() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="h-14 animate-pulse border-b border-[#333333] bg-[#141414]" />
      <div className="px-5 py-8 space-y-6">
        <div className="h-9 w-40 animate-pulse rounded bg-[#1a1a1a]" />
        <div className="flex gap-8 border-b border-[#333333] pb-3">
          <div className="h-5 w-28 animate-pulse rounded bg-[#1a1a1a]" />
          <div className="h-5 w-20 animate-pulse rounded bg-[#1a1a1a]" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] animate-pulse rounded border border-[#2a2a2a] bg-[#141414]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
