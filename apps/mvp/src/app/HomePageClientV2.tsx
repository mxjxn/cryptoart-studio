"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { formatEther } from "viem";
import { motion } from "framer-motion";
import { TransitionLink } from "~/components/TransitionLink";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { useEnsNameForAddress } from "~/hooks/useEnsName";
import { AdminToolsPanel } from "~/components/AdminToolsPanel";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { useMiniApp } from "@neynar/react";
import { useAuthMode } from "~/hooks/useAuthMode";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { EnrichedAuctionData } from "~/lib/types";
import { canonicalListingDetailPath } from "~/lib/listing-chain-paths";
import { BASE_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import { usePretextMeasure } from "~/hooks/usePretextMeasure";
import {
  KISMET_GRADIENTS,
  tier1CardToDisplayAuction,
  FEATURED_HEADER_TEXT,
  FEATURED_HEADER_SUBLINE,
  FEATURED_MAINNET_EYEBROW,
  FEATURED_MAINNET_HEADLINE,
  FEATURED_MAINNET_DESCRIPTION,
} from "~/lib/homepage-static-data";
import { useBrowseListings } from "~/hooks/useBrowseListings";
import { useKismetAuctions } from "~/hooks/useKismetAuctions";
import { useMainnetSpotlight } from "~/hooks/useMainnetSpotlight";
import { useHomePageMotion } from "~/hooks/useHomePageMotion";
import { useArtistName } from "~/hooks/useArtistName";
import { MainnetFirstListingArtCard } from "~/components/home/MainnetFirstListingArtCard";
import { StaticArtworkTile } from "~/components/home/StaticArtworkTile";
import { LoadingModal } from "~/components/home/LoadingModal";

const truncateAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

function BidderIdentity({ bidder, bidCount }: { bidder?: string; bidCount?: number }) {
  if (!bidder) {
    const count = bidCount || 0;
    return <>{count > 0 ? `${count} bid${count === 1 ? "" : "s"}` : "Unknown bidder"}</>;
  }

  const { artistName } = useArtistName(bidder);
  return <>{artistName || truncateAddress(bidder)}</>;
}

export default function HomePageClientV2() {
  const hideAuctionCards = process.env.NEXT_PUBLIC_HOME_TEASER === "true";

  const { kismetTier1Lots, kismetFullListings } = useKismetAuctions(hideAuctionCards);
  const { mainnetSpotlightAuctions } = useMainnetSpotlight(hideAuctionCards);

  const nftBrowse = useBrowseListings({ tokenSpec: "ERC721", enabled: !hideAuctionCards });
  const editionBrowse = useBrowseListings({ tokenSpec: "ERC1155", enabled: !hideAuctionCards });

  const [loadingListing, setLoadingListing] = useState<{
    listingId: string;
    image: string | null;
    title: string;
  } | null>(null);

  const { isPro, loading: membershipLoading } = useMembershipStatus();
  const isMember = isPro;
  const { actions, context } = useMiniApp();
  const { isMiniApp } = useAuthMode();
  const { address, isConnected } = useEffectiveAddress();
  const ensName = useEnsNameForAddress(address, !isMiniApp && isConnected && !!address);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const homeMotion = useHomePageMotion(searchParams);

  useEffect(() => {
    if (loadingListing) {
      if (pathname && pathname !== "/" && pathname.startsWith("/listing/")) {
        const timer = setTimeout(() => setLoadingListing(null), 300);
        return () => clearTimeout(timer);
      } else {
        const fallbackTimer = setTimeout(() => setLoadingListing(null), 5000);
        return () => clearTimeout(fallbackTimer);
      }
    }
  }, [pathname, loadingListing]);

  const isMiniAppInstalled = context?.client?.added ?? false;

  const displayHandle = isMiniApp
    ? context?.user?.username
      ? `@${context.user.username}`
      : context?.user?.displayName ?? "Guest"
    : !isConnected || !address
      ? "Connect wallet"
      : ensName
        ? `@${ensName.replace(/^@/, "")}`
        : `@${address.slice(0, 6)}…${address.slice(-4)}`;

  const formatListingEth = (a: EnrichedAuctionData) => {
    try {
      const v = a.currentPrice || a.initialAmount || "0";
      return `${formatEther(BigInt(v))} ETH`;
    } catch {
      return "— ETH";
    }
  };

  const bidTimestamp = (a: EnrichedAuctionData) => {
    try {
      return BigInt(a.highestBid?.timestamp ?? "0");
    } catch {
      return 0n;
    }
  };

  const featuredBidListings: EnrichedAuctionData[] = [];
  const marketBidListings = [...nftBrowse.listings, ...editionBrowse.listings].filter(
    (auction) => auction.highestBid?.amount,
  );
  const seenBidIds = new Set<string>();
  const bidListings = [...featuredBidListings, ...marketBidListings]
    .filter((auction) => {
      if (seenBidIds.has(auction.listingId)) return false;
      seenBidIds.add(auction.listingId);
      return true;
    })
    .sort((a, b) => {
      const bt = bidTimestamp(b);
      const at = bidTimestamp(a);
      if (bt !== at) return bt > at ? 1 : -1;
      return (b.bidCount || 0) - (a.bidCount || 0);
    })
    .slice(0, 4);

  const gutter = "px-3 sm:px-5 md:px-8 lg:px-12 xl:px-16";
  const sectionFullBleed = "relative w-[100vw] max-w-[100vw] shrink-0 ml-[calc(50%-50vw)]";

  const showDataDegradedNotice =
    !hideAuctionCards &&
    (nftBrowse.subgraphDown ||
      editionBrowse.subgraphDown ||
      !!nftBrowse.error ||
      !!editionBrowse.error);

  const heroTaglineText =
    "CryptoArt is an auction marketplace for digital art, centered on human curation. List on Base or Ethereum mainnet — create galleries to surface what matters.";
  const heroDescriptionText = FEATURED_MAINNET_DESCRIPTION;
  const recentSectionIntro =
    "Kismet Casa · Rome residency — Base lots from the recent drop. Events have concluded; open a card to view the listing.";

  const heroTaglineMeasure = usePretextMeasure<HTMLParagraphElement>({
    text: heroTaglineText,
    font: "400 14px Space Grotesk",
    lineHeightPx: 21,
  });
  const heroDescriptionMeasure = usePretextMeasure<HTMLParagraphElement>({
    text: heroDescriptionText,
    font: "400 14px Space Grotesk",
    lineHeightPx: 21,
  });
  const lotIntroMeasure = usePretextMeasure<HTMLParagraphElement>({
    text: recentSectionIntro,
    font: "400 14px MEK-Mono",
    lineHeightPx: 21,
  });
  const featuredCardMeasure = usePretextMeasure<HTMLDivElement>({
    text: heroDescriptionText,
    font: "400 14px Space Grotesk",
    lineHeightPx: 21,
  });

  const mainnetFeaturedReady = !hideAuctionCards && mainnetSpotlightAuctions.length > 0;

  const heroCtaClassName =
    "inline-flex min-h-[52px] w-full max-w-none items-center justify-center border-2 border-white bg-transparent px-6 py-3.5 !font-space-grotesk text-base font-medium leading-tight tracking-[0.08em] text-white transition-colors hover:bg-white hover:text-black sm:min-h-[60px] sm:min-w-0 sm:flex-1 sm:px-8 sm:py-4 sm:text-lg";

  const limeCtaClassName =
    "inline-flex min-h-[48px] w-full max-w-none items-center justify-center border-2 border-black bg-transparent px-5 py-3 !font-space-grotesk text-sm font-medium leading-tight tracking-[0.06em] !text-black transition-colors hover:bg-black hover:!text-[rgb(220,245,76)] sm:min-h-[52px] sm:text-base";

  const pretextDebugEnabled =
    process.env.NODE_ENV !== "production" && searchParams.get("pretextDebug") === "1";

  return (
    <div ref={homeMotion.pageRef} className="flex min-h-screen justify-center overflow-x-clip bg-black">
      <div className="flex w-full max-w-none flex-col border-x border-[#222] bg-transparent shadow-2xl sm:max-w-[min(100%,720px)] md:max-w-[min(100%,900px)] lg:max-w-[min(100%,1100px)] xl:max-w-[min(100%,1280px)]">
        {/* Membership strip */}
        {!membershipLoading && (
          <button
            type="button"
            onClick={() => router.push("/membership")}
            className={`${sectionFullBleed} flex flex-col items-center justify-center gap-1 bg-[#f5b0d3] px-3 py-2.5 text-center font-space-grotesk text-[11px] font-medium leading-snug text-black sm:flex-row sm:flex-wrap sm:gap-x-2 sm:gap-y-0 sm:px-4 sm:py-2 sm:text-xs`}
          >
            {isMember ? (
              <span className="text-black">Member — thanks for supporting infrastructure &amp; open-source</span>
            ) : (
              <>
                <span className="max-w-[42rem] text-black">
                  Support infrastructure &amp; open-source behind cryptoart.social
                </span>
                <span className="text-black tabular-nums">0.0001 ETH / month</span>
              </>
            )}
          </button>
        )}

        {/* Data degraded notice */}
        {showDataDegradedNotice && (
          <section className={`border-b border-[#333333] bg-[#221f12] ${sectionFullBleed}`}>
            <div className={`py-2 font-mek-mono text-xs text-[#f6d87d] ${gutter}`}>
              Live listing data is temporarily degraded. You may see placeholders or delayed updates while services recover.
            </div>
          </section>
        )}

        {/* Identity row */}
        <div className={`${sectionFullBleed} flex items-center justify-between bg-black py-5 font-mek-mono text-sm text-white ${gutter}`}>
          <span className="min-w-0 truncate">{displayHandle}</span>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#333333] text-white"
              aria-hidden="true"
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
                <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 0 1 0 1.7l-1 1a1.2 1.2 0 0 1-1.7 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.2 1.2 0 0 1-1.2 1.2h-1.4A1.2 1.2 0 0 1 10.4 20v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.2 1.2 0 0 1-1.7 0l-1-1a1.2 1.2 0 0 1 0-1.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1.2 1.2 0 0 1-1.2-1.2v-1.4A1.2 1.2 0 0 1 4 10.4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.2 1.2 0 0 1 0-1.7l1-1a1.2 1.2 0 0 1 1.7 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4A1.2 1.2 0 0 1 10.4 2.8h1.4A1.2 1.2 0 0 1 13 4v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.2 1.2 0 0 1 1.7 0l1 1a1.2 1.2 0 0 1 0 1.7l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1.2 1.2 0 0 1 1.2 1.2v1.4a1.2 1.2 0 0 1-1.2 1.2h-.2a1 1 0 0 0-.9.6Z" />
              </svg>
            </span>
            <ProfileDropdown />
          </div>
        </div>

        {/* Hero */}
        <motion.section
          className={`${sectionFullBleed} flex flex-col gap-4 bg-black pb-5 pt-5 md:flex-row md:items-center md:gap-8 md:pb-8 ${gutter}`}
          initial={homeMotion.shouldAnimate ? { opacity: 0, y: 22, scale: 0.985 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{ y: homeMotion.heroY, opacity: homeMotion.heroOpacity, scale: homeMotion.heroScale }}
        >
          <div className="relative aspect-[384/119] w-full md:w-1/2 md:max-w-xl md:shrink-0">
            <Image
              src="/cryptoart-logo-wgmeets.png"
              alt="CryptoArt"
              fill
              className="object-contain object-center"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 45vw, 576px"
              priority
            />
          </div>
          <div className="md:flex-1 md:py-0">
            <p ref={heroTaglineMeasure.ref} className="font-space-grotesk text-sm leading-normal text-white">
              {heroTaglineText}
            </p>
            <div className="mt-6 flex w-full max-w-2xl flex-col gap-4 sm:mt-8 sm:flex-row sm:items-stretch sm:gap-5">
              <TransitionLink href="/create" prefetch={false} className={heroCtaClassName}>
                Create listing
              </TransitionLink>
              <TransitionLink href="/market" prefetch={false} className={heroCtaClassName}>
                View all listings
              </TransitionLink>
            </div>
          </div>
        </motion.section>

        {/* Pretext debug */}
        {pretextDebugEnabled && (
          <section className={`${sectionFullBleed} border-y border-[#333333] bg-black py-3 font-space-grotesk text-xs text-[#f5b0d3] ${gutter}`}>
            <div className="grid gap-1 md:grid-cols-3">
              <p>
                heroTagline lines: actual {heroTaglineMeasure.actualLineCount} / predicted {heroTaglineMeasure.predicted.lineCount} (w{" "}
                {Math.round(heroTaglineMeasure.width)}px)
              </p>
              <p>
                heroDescription lines: actual {heroDescriptionMeasure.actualLineCount} / predicted{" "}
                {heroDescriptionMeasure.predicted.lineCount} (w {Math.round(heroDescriptionMeasure.width)}px)
              </p>
              <p>
                lotIntro lines: actual {lotIntroMeasure.actualLineCount} / predicted {lotIntroMeasure.predicted.lineCount} (w{" "}
                {Math.round(lotIntroMeasure.width)}px)
              </p>
              <p>
                featured card width: {Math.round(featuredCardMeasure.width)}px
              </p>
            </div>
          </section>
        )}

        {/* Featured / Galleries (lime) */}
        <motion.section
          ref={homeMotion.featuredSectionRef}
          className={`${sectionFullBleed} overflow-x-clip bg-[#dcf54c] text-neutral-900`}
          initial={homeMotion.shouldAnimate ? { opacity: 0, y: 24 } : false}
          whileInView={homeMotion.shouldAnimate ? { opacity: 1, y: 0 } : undefined}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.h2
            ref={homeMotion.featuredHeaderMeasureRef}
            className={`sticky top-0 z-0 space-y-2 pt-5 font-space-grotesk font-medium leading-[0.9] text-neutral-500 ${gutter}`}
          >
            {hideAuctionCards || mainnetFeaturedReady ? (
              <>
                <span className="block w-full bg-gradient-to-b from-[#a7a7a7] via-[#d3d3d3] to-[#dddddd] bg-clip-text text-[clamp(2.25rem,11vw,4.75rem)] leading-[0.95] text-transparent">
                  {FEATURED_HEADER_TEXT}
                </span>
                <span className="block font-space-grotesk text-base font-medium leading-snug tracking-wide text-neutral-700 md:text-lg">
                  {FEATURED_HEADER_SUBLINE}
                </span>
              </>
            ) : (
              <span className="block w-full bg-gradient-to-b from-[#a7a7a7] via-[#d3d3d3] to-[#dddddd] bg-clip-text text-[clamp(2.25rem,11vw,4.75rem)] leading-[0.95] text-transparent">
                Ethereum
              </span>
            )}
          </motion.h2>
          <motion.div
            className={`relative z-10 mt-0 bg-[#dcf54c] pb-6 ${gutter}`}
            style={{ y: homeMotion.featuredContentY }}
          >
            <div
              className={
                hideAuctionCards
                  ? "grid gap-3"
                  : mainnetFeaturedReady
                    ? "grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] lg:items-stretch lg:gap-4"
                    : "grid gap-3"
              }
            >
              <div className="relative min-h-[360px] overflow-hidden border border-black/15 bg-[#dcf54c] text-black">
                <div className="absolute inset-0" style={{ background: KISMET_GRADIENTS[0] }} aria-hidden />
                <div className="absolute inset-0 bg-white/25" aria-hidden />
                <div ref={featuredCardMeasure.ref} className="relative flex min-h-[360px] flex-col justify-between gap-6 p-4 sm:p-6">
                  <div className="font-space-grotesk text-sm uppercase tracking-[0.18em] text-black">
                    {FEATURED_MAINNET_EYEBROW}
                  </div>
                  <div className="max-w-xl">
                    <h3 className="!font-space-grotesk text-[clamp(2.25rem,10vw,5.25rem)] font-medium leading-[0.9] text-black">
                      {FEATURED_MAINNET_HEADLINE}
                    </h3>
                    <p ref={heroDescriptionMeasure.ref} className="mt-4 max-w-lg !font-space-grotesk text-sm leading-normal text-black">
                      {heroDescriptionText}
                    </p>
                  </div>
                  <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4">
                    <TransitionLink href="/create" prefetch={false} className={limeCtaClassName}>
                      Create listing
                    </TransitionLink>
                  </div>
                  {(hideAuctionCards || mainnetFeaturedReady) && (
                    <div className="flex flex-wrap items-center gap-2 font-space-grotesk text-sm">
                      <span className="border border-black px-2.5 py-1 !text-black">
                        {hideAuctionCards
                          ? "Ethereum + Base"
                          : mainnetSpotlightAuctions.length === 1
                            ? "Ethereum mainnet · listing in view"
                            : `${mainnetSpotlightAuctions.length} Ethereum listings`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {!hideAuctionCards && mainnetFeaturedReady && (
                <div className="flex min-h-0 w-full min-w-0 flex-col lg:h-full lg:min-h-[360px]">
                  {mainnetSpotlightAuctions.map((auction, index) => (
                    <MainnetFirstListingArtCard
                      key={`eth-spotlight-${auction.listingId}-${index}`}
                      auction={auction}
                      gradient={KISMET_GRADIENTS[(index + 3) % KISMET_GRADIENTS.length]}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
          <div className={`flex items-center justify-between border-t border-black/20 py-2.5 font-mek-mono text-sm text-black ${gutter}`}>
            {hideAuctionCards ? (
              <>
                <span className="text-black">Ethereum mainnet</span>
                <span className="text-black">Create from app</span>
              </>
            ) : (
              <>
                <span className="text-black">Ethereum mainnet</span>
                <span className="text-black">
                  {mainnetSpotlightAuctions.length > 0
                    ? mainnetSpotlightAuctions.length === 1
                      ? "First listing · Ethereum"
                      : `${mainnetSpotlightAuctions.length} Ethereum listings`
                    : "Ethereum mainnet"}
                </span>
              </>
            )}
          </div>
        </motion.section>

        {/* Bids strip */}
        {!hideAuctionCards && (
          <section className={`${sectionFullBleed} bg-white text-black`}>
            {nftBrowse.loading || editionBrowse.loading ? (
              <>
                <h2 className={`pb-2 pt-5 font-mek-mono text-[clamp(2rem,11vw,4.25rem)] font-medium leading-none text-black ${gutter}`}>
                  Bids
                </h2>
                <div className={`flex flex-col divide-y divide-neutral-200 pb-6 md:grid md:grid-cols-2 md:gap-4 md:divide-y-0 xl:grid-cols-4 ${gutter}`}>
                  <p className="p-2.5 font-mek-mono text-sm text-neutral-600 md:col-span-2 xl:col-span-4">Loading…</p>
                </div>
              </>
            ) : bidListings.length > 0 ? (
              <>
                <h2 className={`pb-2 pt-5 font-mek-mono text-[clamp(2rem,11vw,4.25rem)] font-medium leading-none text-black ${gutter}`}>
                  Bids
                </h2>
                <div className={`flex flex-col divide-y divide-neutral-200 pb-6 md:grid md:grid-cols-2 md:gap-4 md:divide-y-0 xl:grid-cols-4 ${gutter}`}>
                  {bidListings.map((auction, index) => (
                    <TransitionLink
                      key={`${auction.listingId}-${auction.tokenSpec}-${index}`}
                      href={canonicalListingDetailPath(
                        auction.chainId ?? BASE_CHAIN_ID,
                        auction.listingId,
                      )}
                      prefetch={false}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
                    >
                      <div className="flex items-center gap-2.5 p-2.5 md:border md:border-neutral-200">
                        <div
                          className="relative h-14 w-12 shrink-0 overflow-hidden bg-neutral-200"
                          style={{ background: KISMET_GRADIENTS[Number(auction.tokenId ?? 1) % KISMET_GRADIENTS.length] }}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1 font-space-grotesk text-sm">
                          <p className="truncate text-black">{auction.title || "Listing"}</p>
                          <p className="truncate text-black">by {auction.artist || "—"}</p>
                        </div>
                        <div className="shrink-0 text-right font-mek-mono text-sm text-black">
                          <p className="text-black">
                            {formatListingEth({
                              ...auction,
                              currentPrice: auction.highestBid?.amount || auction.currentPrice,
                            })}
                          </p>
                          <p className="text-black">
                            <BidderIdentity bidder={auction.highestBid?.bidder} bidCount={auction.bidCount} />
                          </p>
                        </div>
                      </div>
                    </TransitionLink>
                  ))}
                </div>
              </>
            ) : (
              <div className={`border-t border-neutral-200 py-8 md:py-10 ${gutter}`}>
                <p className="max-w-2xl font-space-grotesk text-sm leading-relaxed text-neutral-700 md:text-base">
                  <span className="font-bold text-neutral-900">No live auctions</span> with bids to show yet.{" "}
                  <TransitionLink
                    href="/create"
                    prefetch={false}
                    className="font-medium text-neutral-900 underline decoration-neutral-400 underline-offset-4 transition-colors hover:decoration-neutral-900"
                  >
                    Start one
                  </TransitionLink>{" "}
                  to see your name here.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Recent: Kismet Casa lots */}
        {!hideAuctionCards && (
          <section className={`${sectionFullBleed} bg-[#111111]`}>
            <h2 className={`pb-2 pt-5 font-space-grotesk text-[clamp(2rem,11vw,4.25rem)] font-medium leading-none text-white ${gutter}`}>
              Recent
            </h2>
            <p ref={lotIntroMeasure.ref} className={`pb-5 font-mek-mono text-sm text-[#aaaaaa] ${gutter}`}>
              {recentSectionIntro}
            </p>
            <div className={`grid grid-cols-2 gap-2.5 px-3 pb-6 sm:grid-cols-3 sm:px-5 md:px-8 lg:grid-cols-3 lg:px-12 xl:px-16`}>
              {kismetTier1Lots.slice(0, 6).map((auction, index) => (
                <StaticArtworkTile
                  key={`recent-kismet-${auction.listingId}`}
                  auction={tier1CardToDisplayAuction(auction, index, kismetFullListings)}
                  gradient={KISMET_GRADIENTS[index % KISMET_GRADIENTS.length]}
                />
              ))}
            </div>
            <div className={`border-t border-[#2b2b2b] pb-8 ${gutter}`}>
              <TransitionLink
                href="/user/kismet/gallery/kismet-casa-rome-auction"
                prefetch={false}
                className="font-space-grotesk text-sm text-white underline-offset-4 hover:underline"
              >
                View Kismet Casa gallery →
              </TransitionLink>
            </div>
          </section>
        )}

        {/* Mini-app install */}
        {isMiniApp && !isMiniAppInstalled && actions && (
          <section className={`${sectionFullBleed} border-b border-[#333333] bg-black`}>
            <div className={`flex items-center justify-center py-3 ${gutter}`}>
              <button
                type="button"
                onClick={actions.addMiniApp}
                className="font-mek-mono text-[#999999] underline decoration-[#999999] hover:text-[#cccccc]"
              >
                Add mini-app to Farcaster
              </button>
            </div>
          </section>
        )}
      </div>

      <AdminToolsPanel />
      <LoadingModal loadingListing={loadingListing} />
    </div>
  );
}
