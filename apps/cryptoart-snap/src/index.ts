import { Hono } from "hono";
import type {
  SnapElementInput,
  SnapFunction,
  SnapHandlerResult,
} from "@farcaster/snap";
import { registerSnapHandler } from "@farcaster/snap-hono";
import { formatEther } from "viem";

const DEFAULT_APP = "https://cryptoart.social";

function cryptoartAppUrl(): string {
  return (process.env.CRYPTOART_APP_URL ?? DEFAULT_APP).replace(/\/$/, "");
}

/** Public snap origin (Vercel / snap.cryptoart.social). Used if we add submit round-trips later. */
function snapBaseUrlFromRequest(request: Request): string {
  const fromEnv = process.env.SNAP_PUBLIC_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const host = (forwardedHost ?? hostHeader)?.split(",")[0].trim();
  const isLoopback =
    host !== undefined &&
    /^(localhost|127\.0.0\.1|\[::1\]|::1)(:\d+)?$/.test(host);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = forwardedProto
    ? forwardedProto.split(",")[0].trim().toLowerCase()
    : isLoopback
      ? "http"
      : "https";
  if (host) return `${proto}://${host}`.replace(/\/$/, "");
  return `http://localhost:${process.env.PORT ?? "3003"}`.replace(/\/$/, "");
}

function clamp(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

function safeHttpsImageUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  if (u.startsWith("https://")) return u;
  if (u.startsWith("http://localhost")) return u;
  return null;
}

interface GalleryApiBody {
  gallery?: {
    title: string;
    description?: string | null;
    itemCount: number;
    listings: Array<{
      listingId: string;
      title?: string;
      thumbnailUrl?: string;
      image?: string;
      displayOrder?: number;
    }>;
  };
  error?: string;
}

interface AuctionApiBody {
  listingId?: string;
  title?: string;
  artist?: string;
  thumbnailUrl?: string;
  image?: string;
  listingType?: string;
  tokenSpec?: string;
  currentPrice?: string;
  initialAmount?: string;
  endTime?: string;
  status?: string;
  totalAvailable?: string;
  totalSold?: string;
  totalPerSale?: string;
  bidCount?: number;
  highestBid?: { amount: string };
  error?: string;
}

function formatEth(wei: string | undefined): string {
  if (!wei) return "—";
  try {
    return `${formatEther(BigInt(wei))} ETH`;
  } catch {
    return "—";
  }
}

function timeLeftLabel(endTimeStr: string | undefined): string {
  if (!endTimeStr) return "";
  try {
    const end = BigInt(endTimeStr);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (end <= now) return "Auction ended";
    const sec = end - now;
    const h = sec / 3600n;
    const m = (sec % 3600n) / 60n;
    if (h >= 48n) return `${String(h / 24n)}d left`;
    if (h >= 1n) return `${String(h)}h left`;
    return `${String(m)}m left`;
  } catch {
    return "";
  }
}

function listingStatusLine(a: AuctionApiBody): string {
  const lt = a.listingType ?? "";
  if (lt === "INDIVIDUAL_AUCTION") {
    const price =
      a.currentPrice && a.currentPrice !== "0"
        ? formatEth(a.currentPrice)
        : formatEth(a.initialAmount);
    const bid = a.highestBid?.amount
      ? `High ${formatEth(a.highestBid.amount)}`
      : "No bids yet";
    const clock = timeLeftLabel(a.endTime);
    return clamp([price, bid, clock].filter(Boolean).join(" · "), 320);
  }
  if (lt === "FIXED_PRICE" || lt === "DYNAMIC_PRICE") {
    const price = formatEth(a.currentPrice ?? a.initialAmount);
    return clamp(`Buy now · ${price}`, 320);
  }
  if (lt === "OFFERS_ONLY") {
    return clamp("Offers only · open in app", 320);
  }
  return clamp(formatEth(a.currentPrice ?? a.initialAmount), 320);
}

function editionLine(a: AuctionApiBody): string | undefined {
  if (a.tokenSpec !== "ERC1155") return undefined;
  try {
    const avail = BigInt(a.totalAvailable ?? "0");
    const sold = BigInt(a.totalSold ?? "0");
    const left = avail > sold ? avail - sold : 0n;
    return clamp(`Edition · ${String(left)} left`, 160);
  } catch {
    return undefined;
  }
}

async function fetchGallery(
  base: string,
  identifier: string,
  slug: string,
): Promise<GalleryApiBody | null> {
  const url = `${base}/api/curation/user/${encodeURIComponent(identifier)}/gallery/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  return (await res.json()) as GalleryApiBody;
}

async function fetchListing(
  base: string,
  listingId: string,
): Promise<AuctionApiBody | null> {
  const url = `${base}/api/auctions/${encodeURIComponent(listingId)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    success?: boolean;
    auction?: AuctionApiBody;
    error?: string;
  };
  if (!json.auction) return null;
  return json.auction;
}

function missingParamsSnap(request: Request): SnapHandlerResult {
  const base = snapBaseUrlFromRequest(request);
  const hint = clamp(
    `Add query params: ?kind=gallery&identifier=…&slug=… or ?kind=listing&listingId=… — ${base}/?kind=gallery&identifier=demo&slug=my-gallery`,
    320,
  );
  return {
    version: "1.0",
    theme: { accent: "purple" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: { gap: "md" },
          children: ["title", "help"],
        },
        title: {
          type: "text",
          props: {
            content: "CryptoArt teaser",
            weight: "bold",
            size: "md",
          },
        },
        help: {
          type: "text",
          props: { content: hint, size: "sm" },
        },
      },
    },
  };
}

function errorSnap(message: string): SnapHandlerResult {
  return {
    version: "1.0",
    theme: { accent: "purple" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: { gap: "sm" },
          children: ["err"],
        },
        err: {
          type: "text",
          props: { content: clamp(message, 320), size: "sm" },
        },
      },
    },
  };
}

function gallerySnap(
  data: GalleryApiBody,
  identifier: string,
  slug: string,
  base: string,
): SnapHandlerResult {
  const g = data.gallery;
  if (!g) return errorSnap("Gallery not found");

  const title = clamp(g.title, 100);
  const desc = g.description
    ? clamp(g.description, 160)
    : undefined;
  const count = g.itemCount ?? g.listings?.length ?? 0;
  const meta = clamp(`Curated gallery · ${count} listing${count === 1 ? "" : "s"}`, 320);

  const sorted = [...(g.listings ?? [])].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
  );
  const previews = sorted.slice(0, 3);

  const galleryUrl = `${base}/user/${encodeURIComponent(identifier)}/gallery/${encodeURIComponent(slug)}`;

  const children: string[] = ["head", "metaText"];
  const elements: Record<string, SnapElementInput> = {
    page: {
      type: "stack",
      props: { gap: "md" },
      children,
    },
    head: {
      type: "item",
      props: {
        title,
        ...(desc ? { description: desc } : {}),
      },
    },
    metaText: {
      type: "text",
      props: { content: meta, size: "sm" },
    },
    openGallery: {
      type: "button",
      props: { label: "Open gallery", variant: "primary" },
      on: {
        press: { action: "open_mini_app", params: { target: galleryUrl } },
      },
    },
  };

  let idx = 0;
  for (const listing of previews) {
    const imgUrl = safeHttpsImageUrl(listing.thumbnailUrl || listing.image);
    const listingUrl = `${base}/listing/${encodeURIComponent(listing.listingId)}`;
    const shortTitle = clamp(listing.title || "Artwork", 100);

    if (imgUrl) {
      const imgId = `img${idx}`;
      elements[imgId] = {
        type: "image",
        props: {
          url: imgUrl,
          aspect: "1:1",
          alt: shortTitle,
        },
      };
      children.push(imgId);
    }

    const btnId = `openListing${idx}`;
    elements[btnId] = {
      type: "button",
      props: { label: clamp(shortTitle, 30), variant: "secondary" },
      on: {
        press: { action: "open_mini_app", params: { target: listingUrl } },
      },
    };
    children.push(btnId);
    idx += 1;
  }

  children.push("openGallery");

  return {
    version: "1.0",
    theme: { accent: "purple" },
    ui: {
      root: "page",
      elements,
    },
  };
}

function listingSnap(data: AuctionApiBody, base: string): SnapHandlerResult {
  const listingId = data.listingId;
  if (!listingId) return errorSnap("Listing not found");

  const title = clamp(data.title || "Listing", 100);
  const artist = data.artist ? clamp(`by ${data.artist}`, 160) : undefined;
  const status = listingStatusLine(data);
  const edition = editionLine(data);

  const imgUrl = safeHttpsImageUrl(data.thumbnailUrl || data.image);
  const listingUrl = `${base}/listing/${encodeURIComponent(listingId)}`;

  const children: string[] = [];
  const elements: Record<string, SnapElementInput> = {
    page: {
      type: "stack",
      props: { gap: "md" },
      children,
    },
    head: {
      type: "item",
      props: {
        title,
        ...(artist ? { description: artist } : {}),
      },
    },
    status: {
      type: "text",
      props: { content: status, size: "sm" },
    },
    openListing: {
      type: "button",
      props: { label: "Open in CryptoArt", variant: "primary" },
      on: {
        press: { action: "open_mini_app", params: { target: listingUrl } },
      },
    },
  };

  children.push("head", "status");
  if (edition) {
    elements.edition = {
      type: "text",
      props: { content: edition, size: "sm" },
    };
    children.push("edition");
  }
  if (imgUrl) {
    elements.hero = {
      type: "image",
      props: {
        url: imgUrl,
        aspect: "1:1",
        alt: title,
      },
    };
    children.unshift("hero");
  }
  children.push("openListing");

  return {
    version: "1.0",
    theme: { accent: "pink" },
    ui: {
      root: "page",
      elements,
    },
  };
}

const snap: SnapFunction = async (ctx) => {
  const url = new URL(ctx.request.url);
  const kind = url.searchParams.get("kind");
  const base = cryptoartAppUrl();

  if (!kind) {
    return missingParamsSnap(ctx.request);
  }

  if (kind === "gallery") {
    const identifier = url.searchParams.get("identifier");
    const slug = url.searchParams.get("slug");
    if (!identifier?.trim() || !slug?.trim()) {
      return errorSnap("Missing identifier or slug");
    }
    const data = await fetchGallery(base, identifier.trim(), slug.trim());
    if (!data?.gallery) {
      return errorSnap("Gallery unavailable or unpublished");
    }
    return gallerySnap(data, identifier.trim(), slug.trim(), base);
  }

  if (kind === "listing") {
    const listingId = url.searchParams.get("listingId");
    if (!listingId?.trim()) {
      return errorSnap("Missing listingId");
    }
    const data = await fetchListing(base, listingId.trim());
    if (!data) {
      return errorSnap("Listing not found");
    }
    return listingSnap(data, base);
  }

  return errorSnap(`Unknown kind: ${kind}`);
};

const app = new Hono();

registerSnapHandler(app, snap, {
  openGraph: {
    title: "CryptoArt",
    description: "Gallery and listing teasers for Farcaster",
  },
});

export default app;
