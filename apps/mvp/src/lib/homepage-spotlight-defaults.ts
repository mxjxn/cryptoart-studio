/** Default lime-section copy — seeded in DB and used as client fallback. */
export const HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS = {
  sectionTitle: "First listing",
  sectionSubline: "Physical artwork",
  eyebrow: "Now live",
  headline: "Ethereum mainnet",
  description:
    "List and collect on Ethereum from the same app as Base. Create a listing, pick your chain first, then approve on the network where your NFT lives. Browse Ethereum-native auctions at paths like /listing/eth/1.",
  ctaLabel: "Create listing",
  ctaHref: "/create",
} as const;

export type HomepageSpotlightCopy = {
  sectionTitle: string;
  sectionSubline: string;
  eyebrow: string;
  headline: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

export function mergeSpotlightCopy(
  partial: Partial<HomepageSpotlightCopy> | null | undefined,
): HomepageSpotlightCopy {
  return {
    sectionTitle: partial?.sectionTitle?.trim() || HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS.sectionTitle,
    sectionSubline: partial?.sectionSubline?.trim() || HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS.sectionSubline,
    eyebrow: partial?.eyebrow?.trim() || HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS.eyebrow,
    headline: partial?.headline?.trim() || HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS.headline,
    description: partial?.description?.trim() || HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS.description,
    ctaLabel: partial?.ctaLabel?.trim() || HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS.ctaLabel,
    ctaHref: partial?.ctaHref?.trim() || HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS.ctaHref,
  };
}
