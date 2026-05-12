import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAuctionServer } from "~/lib/server/auction";
import { ETHEREUM_MAINNET_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import { pickDisplayTitle } from "~/lib/metadata-display";
import type { EnrichedAuctionData } from "~/lib/types";

/** Keep in sync with `HOMEPAGE_MAINNET_LISTING_IDS` in `HomePageClientV2.tsx`. */
const HOMEPAGE_ETH_LISTING_ID = "1";

export const runtime = "nodejs";
export const alt =
  "CryptoArt — auction marketplace for digital art on Base and Ethereum";
export const size = { width: 1200, height: 800 };
export const contentType = "image/png";

const HERO_TAGLINE =
  "CryptoArt is an auction marketplace for digital art, centered on human curation. List on Base or Ethereum mainnet — create galleries to surface what matters.";

const LIME_PANEL_BG =
  "linear-gradient(135deg, #f5acd1 0%, #dcf54c 52%, #ecc100 100%)";

/** “LIVE ON” — large enough to read at 1200×800 embed scale. */
const LIVE_ON_FONT_PX = 46;
/** “ETHEREUM” — 50% larger than previous 76px. */
const ETHEREUM_FONT_PX = 114;

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function readPublic(rel: string): Promise<Buffer | null> {
  const candidates = [
    path.join(process.cwd(), "public", rel),
    path.join(process.cwd(), "apps", "mvp", "public", rel),
  ];
  for (const p of candidates) {
    try {
      return await readFile(p);
    } catch {
      continue;
    }
  }
  return null;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}…`;
}

function listingDisplayTitle(a: EnrichedAuctionData): string {
  const fromMeta = pickDisplayTitle(a.metadata);
  const t = (typeof a.title === "string" && a.title.trim()) || fromMeta || "";
  if (t) return t;
  return `Listing #${a.listingId}`;
}

function listingDisplayArtist(a: EnrichedAuctionData): string {
  const from =
    (typeof a.artist === "string" && a.artist.trim()) ||
    (typeof a.metadata?.artist === "string" && a.metadata.artist.trim()) ||
    "";
  return from || "—";
}

export default async function Image() {
  const [mekMono, mekSans, medodica, logoPng, auction] = await Promise.all([
    readPublic("MEK-Mono.otf"),
    readPublic("MEKSans-Regular.otf"),
    readPublic("MedodicaRegular.otf"),
    readPublic("cryptoart-logo-wgmeets-og-wide.png"),
    withTimeout(
      getAuctionServer(HOMEPAGE_ETH_LISTING_ID, {
        chainId: ETHEREUM_MAINNET_CHAIN_ID,
      }),
      18_000,
      null,
    ),
  ]);

  const logoDataUrl = logoPng
    ? `data:image/png;base64,${logoPng.toString("base64")}`
    : null;

  const fonts: { name: string; data: ArrayBuffer; style: "normal" | "italic" }[] =
    [];
  if (mekMono)
    fonts.push({
      name: "MEK-Mono",
      data: toArrayBuffer(mekMono),
      style: "normal",
    });
  if (mekSans)
    fonts.push({
      name: "MEKSans-Regular",
      data: toArrayBuffer(mekSans),
      style: "normal",
    });
  if (medodica)
    fonts.push({
      name: "MedodicaRegular",
      data: toArrayBuffer(medodica),
      style: "normal",
    });

  const artTitle = auction ? listingDisplayTitle(auction) : "Ethereum listing";
  const artArtist = auction ? listingDisplayArtist(auction) : "—";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#000000",
          fontFamily: "MEK-Mono, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 32,
            padding: "28px 40px 26px",
            background: "#000000",
            minHeight: 200,
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {logoDataUrl ? (
              <img
                src={logoDataUrl}
                alt=""
                width={200}
                height={62}
                style={{
                  width: "200px",
                  height: "auto",
                  maxHeight: "72px",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 600,
                  color: "#ffffff",
                  fontFamily: "MEKSans-Regular, system-ui, sans-serif",
                  letterSpacing: "0.04em",
                }}
              >
                CRYPTOART
              </div>
            )}
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontSize: 26,
                lineHeight: 1.35,
                color: "#e5e5e5",
                fontFamily: "MEKSans-Regular, system-ui, sans-serif",
                fontWeight: 500,
              }}
            >
              {truncate(HERO_TAGLINE, 200)}
            </div>
          </div>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            background: "#dcf54c",
            color: "#111111",
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "row",
              gap: 18,
              padding: "12px 32px 18px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                border: "2px solid rgba(0,0,0,0.2)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: LIME_PANEL_BG,
                padding: "32px 28px",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: LIVE_ON_FONT_PX,
                    letterSpacing: "0.22em",
                    fontWeight: 700,
                    color: "#111111",
                    fontFamily: "MEK-Mono, system-ui, monospace",
                    marginBottom: 20,
                  }}
                >
                  LIVE ON
                </div>
                <div
                  style={{
                    fontSize: ETHEREUM_FONT_PX,
                    fontWeight: 700,
                    lineHeight: 0.92,
                    color: "#0a0a0a",
                    fontFamily:
                      "MedodicaRegular, MEKSans-Regular, system-ui, sans-serif",
                    letterSpacing: "-0.03em",
                  }}
                >
                  ETHEREUM
                </div>
              </div>
            </div>
            <div
              style={{
                flex: 1.05,
                minWidth: 0,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                border: "2px solid rgba(0,0,0,0.35)",
                overflow: "hidden",
                background: "#0a0a0a",
              }}
            >
              <div
                style={{
                  flex: 1,
                  minHeight: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 28,
                  boxSizing: "border-box",
                  background: "#0a0a0a",
                }}
              >
                <div
                  style={{
                    fontSize: 92,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    color: "#dcf54c",
                    fontFamily: "MEK-Mono, system-ui, monospace",
                    textAlign: "center",
                  }}
                >
                  LIST NOW
                </div>
              </div>
              <div
                style={{
                  borderTop: "2px solid rgba(255,255,255,0.12)",
                  background: "#000000",
                  padding: "20px 24px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    lineHeight: 1.2,
                    color: "#fafafa",
                    fontFamily: "MEKSans-Regular, system-ui, sans-serif",
                  }}
                >
                  {truncate(artTitle, 48)}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    lineHeight: 1.3,
                    color: "rgba(255,255,255,0.78)",
                    fontFamily: "MEKSans-Regular, system-ui, sans-serif",
                  }}
                >
                  {truncate(artArtist, 36)}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontFamily: "MEK-Mono, system-ui, monospace",
                    color: "rgba(255,255,255,0.88)",
                    marginTop: 4,
                  }}
                >
                  {`Ethereum · listing #${HOMEPAGE_ETH_LISTING_ID}`}
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 36px 18px",
              borderTop: "2px solid rgba(0,0,0,0.22)",
              fontSize: 20,
              letterSpacing: "0.06em",
              fontWeight: 600,
              color: "#111111",
              fontFamily: "MEK-Mono, system-ui, monospace",
            }}
          >
            <div style={{ display: "flex" }}>cryptoart.social</div>
            <div style={{ display: "flex" }}>Mainnet</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts.length > 0 ? fonts : undefined,
    },
  );
}
