import { Metadata } from "next";
import { APP_NAME, APP_URL } from "~/lib/constants";
import { getMiniAppEmbedMetadata, normalizeUrl } from "~/lib/utils";
import PublicGalleryClient from "./PublicGalleryClient";

interface GalleryPageProps {
  params: Promise<{ username: string; slug: string }>;
}

export async function generateMetadata({ params }: GalleryPageProps): Promise<Metadata> {
  const { username, slug } = await params;
  
  // Fetch gallery data for metadata
  let title = `${APP_NAME} Gallery`;
  let description = "Curated gallery of listings";
  
  // Construct absolute URLs for embed metadata (normalize to prevent double slashes)
  // Farcaster requires absolute URLs for imageUrl and action.url
  const ogImageUrl = normalizeUrl(APP_URL, `/user/${encodeURIComponent(username)}/gallery/${encodeURIComponent(slug)}/opengraph-image`);
  const galleryPageUrl = normalizeUrl(APP_URL, `/user/${encodeURIComponent(username)}/gallery/${encodeURIComponent(slug)}`);
  
  try {
    const response = await fetch(`${APP_URL}/api/curation/user/${encodeURIComponent(username)}/gallery/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });
    if (response.ok) {
      const data = await response.json();
      if (data.gallery) {
        title = `${data.gallery.title} | ${APP_NAME}`;
        description = data.gallery.description || `Curated gallery by ${username}`;
      }
    }
  } catch (error) {
    // Ignore errors, use defaults
  }
  
  // Use the gallery-specific OpenGraph image as the splash screen
  // This shows the gallery details when the mini app launches
  const miniappMetadata = getMiniAppEmbedMetadata(
    ogImageUrl,      // imageUrl for the embed card
    galleryPageUrl,  // action.url where button navigates
    false,           // use launch_miniapp type
    ogImageUrl,      // splashImageUrl - use gallery-specific image
    "Visit Gallery"  // buttonText - custom text for gallery pages
  );
  const frameMetadata = getMiniAppEmbedMetadata(
    ogImageUrl,
    galleryPageUrl,
    true,            // use launch_frame type for backward compatibility
    ogImageUrl,      // splashImageUrl - use gallery-specific image
    "Visit Gallery"  // buttonText - custom text for gallery pages
  );
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 800,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    other: {
      // Farcaster Mini App embed metadata
      // Follows spec: https://miniapps.farcaster.xyz/docs/guides/sharing
      "fc:miniapp": JSON.stringify(miniappMetadata),
      // For backward compatibility - use launch_frame type
      "fc:frame": JSON.stringify(frameMetadata),
    },
  };
}

export default async function GalleryPage({ params }: GalleryPageProps) {
  const { username, slug } = await params;
  return <PublicGalleryClient username={username} slug={slug} />;
}




