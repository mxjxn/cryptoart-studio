"use client";

export function LoadingModal({
  loadingListing,
}: {
  loadingListing: { listingId: string; image: string | null; title: string } | null;
}) {
  if (!loadingListing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative max-w-md w-full mx-4 bg-[#1a1a1a] border border-[#333333] rounded-lg overflow-hidden">
        {loadingListing.image ? (
          <div className="relative w-full aspect-square bg-black">
            <img
              src={loadingListing.image}
              alt={loadingListing.title}
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="relative w-full aspect-square bg-gradient-to-br from-[#667eea] to-[#764ba2]" />
        )}
        <div className="p-6">
          <h3 className="text-lg font-normal text-white mb-2 line-clamp-2">
            {loadingListing.title}
          </h3>
          <div className="flex items-center justify-center gap-2 text-[#999999] text-sm">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>Loading listing</span>
          </div>
        </div>
      </div>
    </div>
  );
}
