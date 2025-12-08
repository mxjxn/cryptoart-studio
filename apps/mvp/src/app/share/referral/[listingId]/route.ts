import { NextRequest, NextResponse } from "next/server";
import { getAuctionServer } from "~/lib/server/auction";
import { generateShareOGImage } from "~/lib/share-og-image";

export const dynamic = "force-dynamic";

/**
 * Share endpoint for referral moment
 * - Returns OG image when scraped by bots
 * - Redirects to listing page when clicked by users
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  const { listingId } = await params;
  const userAgent = request.headers.get("user-agent") || "";

  // Check if this is a bot/scraper request (for OG image)
  const isBot =
    userAgent.includes("bot") ||
    userAgent.includes("crawler") ||
    userAgent.includes("spider") ||
    userAgent.includes("facebookexternalhit") ||
    userAgent.includes("Twitterbot") ||
    userAgent.includes("LinkedInBot") ||
    userAgent.includes("WhatsApp") ||
    userAgent.includes("Slackbot") ||
    request.headers.get("sec-fetch-dest") === "image";

  if (isBot) {
    // Generate OG image
    try {
      const auction = await getAuctionServer(listingId);
      if (!auction) {
        return new NextResponse("Listing not found", { status: 404 });
      }

      const imageResponse = await generateShareOGImage({
        momentType: "referral",
        auction,
      });

      return imageResponse;
    } catch (error) {
      console.error("Error generating OG image:", error);
      return new NextResponse("Error generating image", { status: 500 });
    }
  }

  // Regular user - redirect to listing page
  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
  const referralId = request.nextUrl.searchParams.get("referralId");
  const redirectUrl = new URL(`${baseUrl}/auction/${listingId}`);
  
  if (referralId) {
    redirectUrl.searchParams.set("referralId", referralId);
  }

  return NextResponse.redirect(redirectUrl);
}

