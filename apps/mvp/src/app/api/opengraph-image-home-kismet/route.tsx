import { ImageResponse } from "next/og";

export const runtime = "edge";

const KISMET_OG_LOTS = [
  { title: "the edge of morrow", artist: "tinyrainboot" },
  { title: "Focal Point Tiburtina", artist: "mxjxn.eth" },
  { title: "EYE KISS", artist: "dwn2erth.eth" },
  { title: "VESTIGIUM IV", artist: "0xfb28...262a" },
  { title: '" The Traveler "', artist: "turro" },
  { title: "Path of expansion", artist: "jotta" },
];

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          color: "#ffffff",
          background:
            "radial-gradient(circle at 20% 0%, #333333 0%, #111111 45%, #000000 100%)",
          padding: "44px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              fontSize: 26,
              opacity: 0.9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Kismet Casa · Rome Residency
          </div>
          <div
            style={{
              fontSize: 74,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              marginTop: "12px",
            }}
          >
            Six Live Auctions
          </div>
          <div
            style={{
              fontSize: 28,
              opacity: 0.85,
              marginTop: "12px",
            }}
          >
            Featured on Cryptoart
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            marginTop: "8px",
          }}
        >
          {KISMET_OG_LOTS.map((lot) => (
            <div
              key={lot.title}
              style={{
                display: "flex",
                flexDirection: "column",
                width: "356px",
                minHeight: "92px",
                borderRadius: "14px",
                padding: "14px 16px",
                background:
                  "linear-gradient(135deg, rgba(220,245,76,0.2) 0%, rgba(245,172,209,0.16) 52%, rgba(255,4,2,0.15) 100%)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <div
                style={{
                  fontSize: 25,
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                {lot.title}
              </div>
              <div
                style={{
                  fontSize: 21,
                  opacity: 0.85,
                  marginTop: "8px",
                }}
              >
                by {lot.artist}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate",
      },
    },
  );
}
