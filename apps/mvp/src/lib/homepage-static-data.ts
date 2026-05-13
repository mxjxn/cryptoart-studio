import { formatEther } from "viem";
import type { EnrichedAuctionData } from "~/lib/types";
import { pickDisplayTitle } from "~/lib/metadata-display";

export const FARCON_STATIC_PREVIEW = false;
export const HOMEPAGE_KISMET_STATIC_ONLY = true;
export const TIER1_TIMEOUT_MS = 60_000;
export const TIER2_TIMEOUT_MS = 40_000;

export const FEATURED_HEADER_TEXT = "First listing";
export const FEATURED_HEADER_SUBLINE = "Physical artwork";
export const FEATURED_MAINNET_EYEBROW = "Now live";
export const FEATURED_MAINNET_HEADLINE = "Ethereum mainnet";
export const FEATURED_MAINNET_DESCRIPTION =
  "List and collect on Ethereum from the same app as Base. Create a listing, pick your chain first, then approve on the network where your NFT lives. Browse Ethereum-native auctions at paths like /listing/eth/1.";

export const HOMEPAGE_MAINNET_LISTING_IDS: readonly string[] = ["1"];

export const FEATURED_HEADER_HEIGHT_FALLBACK_PX = 168;

export const KISMET_GRADIENTS = [
  "linear-gradient(135deg, #f5acd1 0%, #dcf54c 52%, #ecc100 100%)",
  "linear-gradient(135deg, #ff0402 0%, #f5acd1 45%, #272727 100%)",
  "linear-gradient(135deg, #dcf54c 0%, #ffffff 48%, #f5acd1 100%)",
  "linear-gradient(135deg, #ecc100 0%, #ff0402 55%, #000000 100%)",
  "linear-gradient(135deg, #272727 0%, #dcf54c 50%, #ffffff 100%)",
  "linear-gradient(135deg, #f5acd1 0%, #ff0402 42%, #ecc100 100%)",
  "linear-gradient(135deg, #ffffff 0%, #ecc100 50%, #272727 100%)",
  "linear-gradient(135deg, #dcf54c 0%, #f5acd1 55%, #ff0402 100%)",
];

export const KISMET_STATIC_LOTS: EnrichedAuctionData[] = [
  {
    id: "129",
    listingId: "129",
    chainId: 8453,
    marketplace: "0x1cb0c1f72ba7547fc99c4b5333d8aba1ed6b31a9",
    seller: "0x1216083be36842278fb3cf9c3f56b7792ecc359b",
    tokenAddress: "0x2d40ef321f02f0293a82a95b13422224a6934e48",
    tokenId: "1",
    tokenSpec: "ERC721",
    listingType: "INDIVIDUAL_AUCTION",
    initialAmount: "100000000000000000",
    totalAvailable: "1",
    totalPerSale: "1",
    startTime: "1777887900",
    endTime: "1777992300",
    lazy: false,
    status: "ACTIVE",
    finalized: false,
    totalSold: "0",
    currentPrice: "100000000000000000",
    createdAt: "1777887331",
    createdAtBlock: "45548992",
    bidCount: 0,
    title: "the edge of morrow",
    artist: "tinyrainboot",
    description: "Kismet Casa Rome auction lot.",
    image: "https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/a71cb9afef3c39e6.webp",
    thumbnailUrl: "https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/a71cb9afef3c39e6.webp",
  },
  {
    id: "127",
    listingId: "127",
    chainId: 8453,
    marketplace: "0x1cb0c1f72ba7547fc99c4b5333d8aba1ed6b31a9",
    seller: "0x6da0a1784de1abdde1734ba37eca3d560bf044c0",
    tokenAddress: "0xb6fcc95d41e2d69179123d46016bd9dd3a43b9cf",
    tokenId: "3",
    tokenSpec: "ERC721",
    listingType: "INDIVIDUAL_AUCTION",
    initialAmount: "100000000000000000",
    totalAvailable: "1",
    totalPerSale: "1",
    startTime: "1777887240",
    endTime: "1777992300",
    lazy: false,
    status: "ACTIVE",
    finalized: false,
    totalSold: "0",
    currentPrice: "100000000000000000",
    createdAt: "1777886703",
    createdAtBlock: "45548678",
    bidCount: 0,
    title: "Focal Point Tiburtina",
    artist: "mxjxn.eth",
    description: "Kismet Casa Rome auction lot.",
    image: "https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/2778d25daac520b6.webp",
    thumbnailUrl: "https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/2778d25daac520b6.webp",
  },
  {
    id: "133",
    listingId: "133",
    chainId: 8453,
    marketplace: "0x1cb0c1f72ba7547fc99c4b5333d8aba1ed6b31a9",
    seller: "0xa0be5a9b02b7b7290f89e4e2a01faf46ef00baf5",
    tokenAddress: "0x52e696c69938df205d3526be4ee308964a34f3ab",
    tokenId: "1",
    tokenSpec: "ERC721",
    listingType: "INDIVIDUAL_AUCTION",
    initialAmount: "100000000000000000",
    totalAvailable: "1",
    totalPerSale: "1",
    startTime: "1777895160",
    endTime: "1777992300",
    lazy: false,
    status: "ACTIVE",
    finalized: false,
    totalSold: "0",
    currentPrice: "100000000000000000",
    createdAt: "1777894587",
    createdAtBlock: "45552620",
    bidCount: 0,
    title: "EYE KISS",
    artist: "dwn2erth.eth",
    description: "Kismet Casa Rome auction lot.",
    image: "https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/a5a1975b45df57e8.webp",
    thumbnailUrl: "https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/a5a1975b45df57e8.webp",
  },
  {
    id: "130",
    listingId: "130",
    chainId: 8453,
    marketplace: "0x1cb0c1f72ba7547fc99c4b5333d8aba1ed6b31a9",
    seller: "0xfb287a6c936e6f5ee0e49700125aa5f8da4c262a",
    tokenAddress: "0x928a1ccf1f7f17904b9ff181d037765f9960fc78",
    tokenId: "4",
    tokenSpec: "ERC721",
    listingType: "INDIVIDUAL_AUCTION",
    initialAmount: "14000000000000000",
    totalAvailable: "1",
    totalPerSale: "1",
    startTime: "1777888800",
    endTime: "1777992300",
    lazy: false,
    status: "ACTIVE",
    finalized: false,
    totalSold: "0",
    currentPrice: "14000000000000000",
    createdAt: "1777887593",
    createdAtBlock: "45549123",
    bidCount: 0,
    title: "VESTIGIUM IV",
    artist: "0xfb28…262a",
    description: "Kismet Casa Rome auction lot.",
    image: "https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/046175eb67066229.webp",
    thumbnailUrl: "https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/046175eb67066229.webp",
  },
  {
    id: "131",
    listingId: "131",
    chainId: 8453,
    marketplace: "0x1cb0c1f72ba7547fc99c4b5333d8aba1ed6b31a9",
    seller: "0x6c1cbe8cfc32a74188a9d3bf364945ea53b01b04",
    tokenAddress: "0x08ab6b515c1152fbfd6945428d64b81a1519df17",
    tokenId: "1",
    tokenSpec: "ERC721",
    listingType: "INDIVIDUAL_AUCTION",
    initialAmount: "100000000000000000",
    totalAvailable: "1",
    totalPerSale: "1",
    startTime: "1777894860",
    endTime: "1777992300",
    lazy: false,
    status: "ACTIVE",
    finalized: false,
    totalSold: "0",
    currentPrice: "100000000000000000",
    createdAt: "1777894303",
    createdAtBlock: "45552478",
    bidCount: 0,
    title: "\" The Traveler \"",
    artist: "turro",
    description: "Kismet Casa Rome auction lot.",
    image: "https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/e47b6c9a2acbac5b.webp",
    thumbnailUrl: "https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/e47b6c9a2acbac5b.webp",
  },
  {
    id: "134",
    listingId: "134",
    chainId: 8453,
    marketplace: "0x1cb0c1f72ba7547fc99c4b5333d8aba1ed6b31a9",
    seller: "0x5576274800a2c36489320b2d6994590dc0cf9d1f",
    tokenAddress: "0xc4847c6f1aca6923d90d97b7099afb80e97e47b2",
    tokenId: "1",
    tokenSpec: "ERC721",
    listingType: "INDIVIDUAL_AUCTION",
    initialAmount: "20000000000000000",
    totalAvailable: "1",
    totalPerSale: "1",
    startTime: "1777896300",
    endTime: "1777992300",
    lazy: false,
    status: "ACTIVE",
    finalized: false,
    totalSold: "0",
    currentPrice: "20000000000000000",
    createdAt: "1777895755",
    createdAtBlock: "45553204",
    bidCount: 0,
    title: "Path of expansion",
    artist: "jotta",
    description: "Digital generative art created with TouchDesigner during the Kismet Casa Rome residency.",
    image: "https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/86a87ed18672a2a5.webp",
    thumbnailUrl: "https://hfrlgecdfjtzypfk.public.blob.vercel-storage.com/thumbnails/86a87ed18672a2a5.webp",
  },
];

export type Tier1ListingCard = {
  listingId: string;
  tokenId?: string;
  seller?: string | null;
  title: string;
  artist: string;
  description: string;
  image: string | null;
  thumbnailUrl: string | null;
};

export type Tier2HydrationItem = {
  listingId: string;
  currentPrice: string;
  listingType: string;
  status: string;
  bidCount: number;
  highestBid?: {
    amount: string;
    bidder: string;
    timestamp: string;
  };
  startTime?: string;
  endTime?: string;
  seller?: string | null;
  creatorLabel?: string;
};

const ZERO_SELLER_HYDRATION = "0x0000000000000000000000000000000000000000";

export function isERC721(tokenSpec: EnrichedAuctionData["tokenSpec"]): boolean {
  return tokenSpec === "ERC721" || String(tokenSpec) === "1";
}

export function isERC1155(tokenSpec: EnrichedAuctionData["tokenSpec"]): boolean {
  return tokenSpec === "ERC1155" || String(tokenSpec) === "2";
}

export function tier1CardToDisplayAuction(
  card: Tier1ListingCard,
  index: number,
  fullList: EnrichedAuctionData[] | null | undefined,
): EnrichedAuctionData {
  const full = fullList?.[index];
  if (full && full.listingId === card.listingId) {
    return { ...full, artist: card.artist };
  }
  const ph = KISMET_STATIC_LOTS[index % KISMET_STATIC_LOTS.length]!;
  return {
    ...ph,
    listingId: card.listingId,
    tokenId: card.tokenId || ph.tokenId,
    title: card.title,
    artist: card.artist,
    description: card.description,
    image: card.image ?? undefined,
    thumbnailUrl: card.thumbnailUrl ?? undefined,
    seller: card.seller ?? ph.seller,
  };
}

export function mergeKismetAuctionWithHydration(
  auction: EnrichedAuctionData,
  h?: Tier2HydrationItem,
): EnrichedAuctionData {
  if (!h) return auction;
  const startOk = h.startTime != null && h.startTime !== "" && h.startTime !== "0";
  const endOk = h.endTime != null && h.endTime !== "" && h.endTime !== "0";
  const sellerOk =
    h.seller != null &&
    typeof h.seller === "string" &&
    h.seller.trim().toLowerCase() !== ZERO_SELLER_HYDRATION;
  const creatorOk =
    typeof h.creatorLabel === "string" &&
    h.creatorLabel.trim().length > 0 &&
    h.creatorLabel.trim() !== "—";

  return {
    ...auction,
    startTime: startOk ? h.startTime! : auction.startTime,
    endTime: endOk ? h.endTime! : auction.endTime,
    seller: sellerOk ? h.seller! : auction.seller,
    listingType: (h.listingType || auction.listingType) as EnrichedAuctionData["listingType"],
    status: (h.status || auction.status) as EnrichedAuctionData["status"],
    bidCount: h.bidCount ?? auction.bidCount,
    currentPrice: h.currentPrice || auction.currentPrice,
    highestBid: h.highestBid
      ? {
          amount: h.highestBid.amount,
          bidder: h.highestBid.bidder,
          timestamp: h.highestBid.timestamp,
        }
      : auction.highestBid,
    artist: creatorOk ? h.creatorLabel!.trim() : auction.artist,
  };
}

function isJunkTier1Artist(value: string | null | undefined): boolean {
  if (value == null || typeof value !== "string") return true;
  const v = value.trim().toLowerCase();
  return (
    v === "" ||
    v === "unknown artist" ||
    v === "unknown" ||
    v === "n/a" ||
    v === "null" ||
    v === "anonymous"
  );
}

function shortSellerLabel(seller: string | null | undefined): string {
  if (!seller || seller.length < 12) return "—";
  return `${seller.slice(0, 6)}…${seller.slice(-4)}`;
}

export function sanitizeTier1Card(card: Tier1ListingCard): Tier1ListingCard {
  const trimmed = (card.artist ?? "").trim();
  const artistMissing =
    isJunkTier1Artist(card.artist) || trimmed === "—" || trimmed === "-" || trimmed === "…";
  return {
    ...card,
    artist: artistMissing ? shortSellerLabel(card.seller) : trimmed,
  };
}

export function shouldSkipDynamicRedesignFetch(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  };
  const effectiveType = nav.connection?.effectiveType ?? "";
  const saveData = nav.connection?.saveData ?? false;
  return saveData || effectiveType.includes("2g") || effectiveType.includes("3g");
}

export async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export function formatStaticEth(amount: string | undefined) {
  try {
    return `${formatEther(BigInt(amount || "0"))} ETH`;
  } catch {
    return "TBD";
  }
}

export function listingArtworkUrl(auction: EnrichedAuctionData): string | undefined {
  const u =
    auction.detailThumbnailUrl ||
    auction.thumbnailUrl ||
    auction.image ||
    auction.metadata?.image;
  return typeof u === "string" && u.trim().length > 0 ? u.trim() : undefined;
}

export function listingTileDisplayTitle(auction: EnrichedAuctionData): string {
  const fromAuction =
    (typeof auction.title === "string" && auction.title.trim()) ||
    pickDisplayTitle(auction.metadata) ||
    "";
  if (fromAuction) return fromAuction;
  const id = auction.listingId != null ? String(auction.listingId).trim() : "";
  if (id) return `Listing #${id}`;
  return "Listing";
}

export function listingTileDisplayArtist(auction: EnrichedAuctionData): string {
  const a =
    (typeof auction.artist === "string" && auction.artist.trim()) ||
    (typeof auction.metadata?.artist === "string" && auction.metadata.artist.trim()) ||
    (typeof auction.metadata?.creator === "string" && auction.metadata.creator.trim()) ||
    "";
  return a || "—";
}
