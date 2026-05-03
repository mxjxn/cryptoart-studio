import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { hasGalleryAccess } from "~/lib/server/nft-access";
import { validateListingTheme } from "~/lib/listing-theme";
import { upsertSellerDefaultTheme } from "~/lib/server/listing-theme-persistence";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userAddress, verifiedAddresses, theme } = body as {
      userAddress?: string;
      verifiedAddresses?: string[];
      theme?: unknown;
    };

    if (!userAddress || !isAddress(userAddress as Address)) {
      return NextResponse.json({ error: "Valid userAddress is required" }, { status: 400 });
    }

    const allowed = await hasGalleryAccess(
      userAddress as Address,
      Array.isArray(verifiedAddresses) ? verifiedAddresses : undefined
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Membership required to customize listing pages" },
        { status: 403 }
      );
    }

    const parsed = validateListingTheme(theme);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await upsertSellerDefaultTheme(userAddress.toLowerCase(), parsed.theme);

    return NextResponse.json({ ok: true, theme: parsed.theme });
  } catch (e) {
    console.error("[listing-theme/default PATCH]", e);
    return NextResponse.json({ error: "Failed to save theme" }, { status: 500 });
  }
}
