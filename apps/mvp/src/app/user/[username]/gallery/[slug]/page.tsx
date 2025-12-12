import { Metadata } from "next";
import { APP_NAME, APP_URL } from "~/lib/constants";
import PublicGalleryClient from "./PublicGalleryClient";

interface GalleryPageProps {
  params: Promise<{ username: string; slug: string }>;
}

export async function generateMetadata({ params }: GalleryPageProps): Promise<Metadata> {
  const { username, slug } = await params;
  
  // Fetch gallery data for metadata
  let title = `${APP_NAME} Gallery`;
  let description = "Curated gallery of listings";
  const ogImageUrl = `${APP_URL}/user/${encodeURIComponent(username)}/gallery/${encodeURIComponent(slug)}/opengraph-image`;
  
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
  };
}

export default async function GalleryPage({ params }: GalleryPageProps) {
  const { username, slug } = await params;
  return <PublicGalleryClient username={username} slug={slug} />;
}




