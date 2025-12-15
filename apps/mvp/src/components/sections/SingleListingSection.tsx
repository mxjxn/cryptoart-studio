import type { EnrichedAuctionData } from '~/lib/types';
import { AuctionCard } from '~/components/AuctionCard';

const gradients = [
  "from-[#00D1FF] via-[#00FFA3] to-[#7700FF]",
  "from-[#FF6B35] via-[#FFD166] to-[#6A00FF]",
  "from-[#F72585] via-[#B5179E] to-[#7209B7]",
  "from-[#00C6FF] via-[#0072FF] to-[#0047AB]",
];

interface SingleListingSectionProps {
  title?: string | null;
  description?: string | null;
  listing: EnrichedAuctionData;
}

export function SingleListingSection({ title, description, listing }: SingleListingSectionProps) {
  return (
    <section className="border-b border-[#333333]">
      <div className="px-5 py-6 space-y-3">
        {title && (
          <h2 className="text-[13px] uppercase tracking-[2px] text-[#999999] font-mek-mono">
            {title}
          </h2>
        )}
        {description && <p className="text-sm text-[#cccccc]">{description}</p>}
        <div className="grid grid-cols-1">
          <AuctionCard
            auction={listing}
            gradient={gradients[0]}
            index={0}
          />
        </div>
      </div>
    </section>
  );
}





