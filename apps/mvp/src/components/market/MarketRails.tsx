import { resolveMarketSections, type HomepageSection } from "~/lib/server/homepage-layout";
import { AuctionCard } from "~/components/AuctionCard";
import { withTimeout } from "~/lib/utils";

const gradients = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
];

/** Match `/api/market-layout` so a slow subgraph cannot hold Suspense forever. */
const RAILS_RESOLVE_MS = 25_000;

export default async function MarketRails() {
  const sections = await withTimeout(
    resolveMarketSections(false),
    RAILS_RESOLVE_MS,
    [] as HomepageSection[]
  );
  if (sections.length === 0) {
    return (
      <div className="mb-10 rounded border border-[#333333] bg-[#111111] px-4 py-6 text-center font-mek-mono text-xs tracking-[0.5px] text-[#888888]">
        Market highlights did not load (timeout or empty layout). Refresh the page, or check
        homepage layout for the &quot;market&quot; surface in admin.
      </div>
    );
  }

  return (
    <div className="mb-10 space-y-10">
      {sections.map((section: HomepageSection, si: number) => (
        <section key={section.id} className="border-b border-[#333333] pb-8 last:border-b-0">
          {(section.title || section.sectionType) && (
            <h2 className="mb-1 font-mek-mono text-sm uppercase tracking-[0.5px] text-white">
              {section.title || section.sectionType.replace(/_/g, " ")}
            </h2>
          )}
          {section.description ? (
            <p className="mb-4 text-xs text-[#999999]">{section.description}</p>
          ) : null}
          {section.listings.length === 0 ? (
            <p className="text-sm text-[#666666]">Nothing in this section yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {section.listings.map((auction, i) => (
                <AuctionCard
                  key={`${section.id}-${String(auction.listingId)}-${String(auction.chainId ?? "")}`}
                  auction={auction}
                  gradient={gradients[(si + i) % gradients.length]}
                  index={i}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
