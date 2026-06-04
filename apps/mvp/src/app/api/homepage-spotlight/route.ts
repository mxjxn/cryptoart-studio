import { NextResponse } from "next/server";
import { mergeSpotlightCopy } from "~/lib/homepage-spotlight-defaults";
import { getHomepageSpotlightConfig } from "~/lib/server/homepage-spotlight";

export const revalidate = 30;

/**
 * Public config for HomePageClientV2 spotlight cards (listing id + chain pins).
 */
export async function GET() {
  try {
    const config = await getHomepageSpotlightConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("[homepage-spotlight] GET failed:", error);
    return NextResponse.json({
      cardsVisible: false,
      pins: [],
      copy: mergeSpotlightCopy(null),
    });
  }
}
