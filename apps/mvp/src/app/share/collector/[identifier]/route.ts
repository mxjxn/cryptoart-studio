import { NextRequest, NextResponse } from "next/server";
import { APP_NAME } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Share endpoint for collector profile
 * - Returns HTML with embed metadata when scraped by bots (for Farcaster embeds)
 * - Redirects to OG image when image is requested
 * - Redirects to profile collected tab when clicked by users
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await params;
  const userAgent = request.headers.get("user-agent") || "";
  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
  const ogImageUrl = `${baseUrl}/share/collector/${encodeURIComponent(identifier)}/opengraph-image`;

  // Check if this is specifically an image request
  const isImageRequest = request.headers.get("sec-fetch-dest") === "image" ||
    request.nextUrl.pathname.includes("/opengraph-image");

  if (isImageRequest) {
    // Redirect to OG image route
    return NextResponse.redirect(ogImageUrl);
  }

  // Check if this is a bot/scraper request (for embed metadata)
  const isBot =
    userAgent.includes("bot") ||
    userAgent.includes("crawler") ||
    userAgent.includes("spider") ||
    userAgent.includes("facebookexternalhit") ||
    userAgent.includes("Twitterbot") ||
    userAgent.includes("LinkedInBot") ||
    userAgent.includes("WhatsApp") ||
    userAgent.includes("Slackbot") ||
    userAgent.includes("farcaster") ||
    userAgent.includes("Neynar");

  if (isBot) {
    // Return HTML with embed metadata for Farcaster and other bots
    // Try to resolve identifier to profile URL
    let profileUrl = `${baseUrl}/`;
    try {
      const userResponse = await fetch(`${baseUrl}/api/user/${encodeURIComponent(identifier)}`, {
        cache: 'no-store',
      });
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.user?.username) {
          profileUrl = `${baseUrl}/user/${userData.user.username}?tab=collections`;
        } else if (userData.primaryAddress) {
          // Try to find username from address
          const addressResponse = await fetch(`${baseUrl}/api/user/${encodeURIComponent(userData.primaryAddress)}`, {
            cache: 'no-store',
          });
          if (addressResponse.ok) {
            const addressData = await addressResponse.json();
            if (addressData.user?.username) {
              profileUrl = `${baseUrl}/user/${addressData.user.username}?tab=collections`;
            }
          }
        }
      }
    } catch (error) {
      console.error("Error resolving profile URL:", error);
    }

    // Create embed metadata
    const miniappMetadata = getMiniAppEmbedMetadata(
      ogImageUrl,
      profileUrl,
      false,        // use launch_miniapp type
      ogImageUrl,
    );
    const frameMetadata = getMiniAppEmbedMetadata(
      ogImageUrl,
      profileUrl,
      true,         // use launch_frame type for backward compatibility
      ogImageUrl,
    );

    // Return HTML with metadata
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Collector Profile | ${APP_NAME}</title>
  <meta name="description" content="View collector profile and collection">
  <meta property="og:title" content="Collector Profile | ${APP_NAME}">
  <meta property="og:description" content="View collector profile and collection">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:type" content="website">
  <meta name="fc:miniapp" content='${JSON.stringify(miniappMetadata)}'>
  <meta name="fc:frame" content='${JSON.stringify(frameMetadata)}'>
  <meta http-equiv="refresh" content="0;url=${profileUrl}">
</head>
<body>
  <p>Redirecting to <a href="${profileUrl}">collector profile</a>...</p>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate',
      },
    });
  }

  // Regular user - redirect to profile collected tab
  // Try to resolve identifier to username or use address
  // If identifier looks like an address, use it directly
  // Otherwise assume it's a username
  const isAddress = /^0x[a-fA-F0-9]{40}$/i.test(identifier);
  
  if (isAddress) {
    // For addresses, try to get username from API, but fallback to address
    try {
      const userResponse = await fetch(`${baseUrl}/api/user/${encodeURIComponent(identifier)}`);
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.user?.username) {
          const redirectUrl = new URL(`${baseUrl}/user/${userData.user.username}`);
          redirectUrl.searchParams.set("tab", "collections");
          return NextResponse.redirect(redirectUrl);
        }
      }
    } catch (error) {
      console.error("Error resolving user:", error);
    }
    
    // Fallback: redirect to homepage if we can't resolve
    return NextResponse.redirect(`${baseUrl}/`);
  } else {
    // Username - redirect to profile with collections tab
    const redirectUrl = new URL(`${baseUrl}/user/${identifier}`);
    redirectUrl.searchParams.set("tab", "collections");
    return NextResponse.redirect(redirectUrl);
  }
}

