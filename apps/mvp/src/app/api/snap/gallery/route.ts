import { NextRequest, NextResponse } from "next/server";

/**
 * Slim JSON for Farcaster snap gallery teasers (optional; cryptoart-snap can use full curation API instead).
 * GET /api/snap/gallery?identifier=...&slug=...
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const identifier = searchParams.get("identifier");
    const slug = searchParams.get("slug");
    if (!identifier?.trim() || !slug?.trim()) {
      return NextResponse.json(
        { error: "identifier and slug are required" },
        { status: 400 },
      );
    }

    const base =
      process.env.NEXT_PUBLIC_URL?.replace(/\/$/, "") ||
      (req.nextUrl.origin ? req.nextUrl.origin.replace(/\/$/, "") : "");
    if (!base) {
      return NextResponse.json(
        { error: "Server URL not configured" },
        { status: 500 },
      );
    }

    const upstream = `${base}/api/curation/user/${encodeURIComponent(identifier.trim())}/gallery/${encodeURIComponent(slug.trim())}`;
    const res = await fetch(upstream, { next: { revalidate: 60 } });
    if (!res.ok) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    const data = (await res.json()) as {
      gallery?: {
        title: string;
        description?: string | null;
        slug?: string | null;
        itemCount: number;
        listings: Array<{
          listingId: string;
          title?: string;
          thumbnailUrl?: string;
          image?: string;
          displayOrder?: number;
        }>;
      };
    };

    const g = data.gallery;
    if (!g) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    const sorted = [...(g.listings ?? [])].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
    );
    const previews = sorted.slice(0, 3).map((l) => ({
      listingId: l.listingId,
      title: l.title,
      thumbnailUrl: l.thumbnailUrl ?? l.image ?? null,
    }));

    const id = identifier.trim();
    const sl = slug.trim();

    return NextResponse.json(
      {
        title: g.title,
        description: g.description ?? null,
        itemCount: g.itemCount,
        slug: g.slug ?? sl,
        listings: previews,
        galleryUrl: `${base}/user/${encodeURIComponent(id)}/gallery/${encodeURIComponent(sl)}`,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (e) {
    console.error("[api/snap/gallery]", e);
    return NextResponse.json({ error: "Failed to load gallery" }, { status: 500 });
  }
}
