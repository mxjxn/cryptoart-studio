import { NextRequest, NextResponse } from "next/server";
import {
  getDatabase,
  homepageSpotlightListings,
  asc,
  eq,
  and,
} from "@cryptoart/db";
import { verifyAdmin } from "~/lib/server/admin";
import { getAuctionServer } from "~/lib/server/auction";
import { BASE_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import {
  getHomepageSpotlightConfig,
  updateHomepageSpotlightSettings,
} from "~/lib/server/homepage-spotlight";
import type { HomepageSpotlightCopy } from "~/lib/homepage-spotlight-defaults";

function parseChainId(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const adminAddress = req.nextUrl.searchParams.get("adminAddress");
    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    const db = getDatabase();
    const config = await getHomepageSpotlightConfig();
    const rows = await db
      .select()
      .from(homepageSpotlightListings)
      .orderBy(asc(homepageSpotlightListings.displayOrder));

    return NextResponse.json({
      cardsVisible: config.cardsVisible,
      copy: config.copy,
      listings: rows,
    });
  } catch (error) {
    console.error("[Admin homepage-spotlight] GET failed:", error);
    return NextResponse.json({ error: "Failed to load spotlight config" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminAddress, cardsVisible, copy } = body as {
      adminAddress?: string;
      cardsVisible?: boolean;
      copy?: Partial<HomepageSpotlightCopy>;
    };

    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    if (cardsVisible !== undefined && typeof cardsVisible !== "boolean") {
      return NextResponse.json({ error: "cardsVisible must be a boolean" }, { status: 400 });
    }

    if (copy?.ctaHref !== undefined && copy.ctaHref.trim() && !copy.ctaHref.startsWith("/")) {
      return NextResponse.json(
        { error: "ctaHref must be an in-app path starting with /" },
        { status: 400 },
      );
    }

    const hasCopy =
      copy &&
      Object.keys(copy).some((k) => copy[k as keyof HomepageSpotlightCopy] !== undefined);
    if (cardsVisible === undefined && !hasCopy) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await updateHomepageSpotlightSettings({
      cardsVisible,
      copy: hasCopy ? copy : undefined,
    });

    const config = await getHomepageSpotlightConfig();
    return NextResponse.json({ success: true, cardsVisible: config.cardsVisible, copy: config.copy });
  } catch (error) {
    console.error("[Admin homepage-spotlight] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update spotlight settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { listingId, chainId: chainIdBody, adminAddress } = body as {
      listingId?: string;
      chainId?: number | string;
      adminAddress?: string;
    };

    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    const trimmedId = listingId?.trim();
    if (!trimmedId) {
      return NextResponse.json({ error: "Listing ID is required" }, { status: 400 });
    }

    const chainId = parseChainId(chainIdBody) ?? BASE_CHAIN_ID;

    const listing = await getAuctionServer(trimmedId, { chainId });
    if (!listing) {
      return NextResponse.json(
        { error: `Listing ${trimmedId} not found on chain ${chainId}` },
        { status: 404 },
      );
    }

    const db = getDatabase();
    const existing = await db
      .select()
      .from(homepageSpotlightListings)
      .orderBy(asc(homepageSpotlightListings.displayOrder));

    const maxOrder =
      existing.length > 0 ? Math.max(...existing.map((r) => r.displayOrder)) + 1 : 0;

    await db
      .insert(homepageSpotlightListings)
      .values({
        listingId: trimmedId,
        chainId,
        displayOrder: maxOrder,
      })
      .onConflictDoNothing({
        target: [homepageSpotlightListings.listingId, homepageSpotlightListings.chainId],
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin homepage-spotlight] POST failed:", error);
    return NextResponse.json({ error: "Failed to add spotlight listing" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const adminAddress = searchParams.get("adminAddress");
    const id = searchParams.get("id");
    const listingId = searchParams.get("listingId");
    const chainId = parseChainId(searchParams.get("chainId"));

    const { isAdmin, error } = verifyAdmin(adminAddress);
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    const db = getDatabase();

    if (id) {
      await db.delete(homepageSpotlightListings).where(eq(homepageSpotlightListings.id, id));
    } else if (listingId && chainId != null) {
      await db
        .delete(homepageSpotlightListings)
        .where(
          and(
            eq(homepageSpotlightListings.listingId, listingId),
            eq(homepageSpotlightListings.chainId, chainId),
          ),
        );
    } else {
      return NextResponse.json(
        { error: "Provide id or listingId + chainId" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin homepage-spotlight] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to remove spotlight listing" }, { status: 500 });
  }
}
