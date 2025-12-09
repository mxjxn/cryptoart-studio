import { Metadata } from "next";
import { APP_NAME, APP_URL } from "~/lib/constants";
import PublicGalleryClient from "./PublicGalleryClient";

interface GalleryPageProps {
  params: Promise<{ username: string; id: string }>;
}

export async function generateMetadata({ params }: GalleryPageProps): Promise<Metadata> {
  const { username, id } = await params;
  
  // Fetch gallery data for metadata
  let title = `${APP_NAME} Gallery`;
  let description = "Curated gallery of listings";
  
  try {
    const response = await fetch(`${APP_URL}/api/curation/user/${encodeURIComponent(username)}/gallery/id/${encodeURIComponent(id)}`, {
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
  };
}

export default async function GalleryPage({ params }: GalleryPageProps) {
  const { username, id } = await params;
  return <PublicGalleryClient username={username} galleryId={id} />;
}


