import { Metadata } from "next";
import { APP_NAME, APP_URL } from "~/lib/constants";
import PublicGalleryClient from "./PublicGalleryClient";

interface PublicGalleryPageProps {
  params: Promise<{ address: string; slug: string }>;
}

export async function generateMetadata({ params }: PublicGalleryPageProps): Promise<Metadata> {
  const { address, slug } = await params;
  
  // Fetch gallery data for metadata
  let title = `${APP_NAME} Gallery`;
  let description = "Curated gallery of listings";
  
  try {
    const response = await fetch(`${APP_URL}/api/curation/slug/${slug}?curatorAddress=${address}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });
    if (response.ok) {
      const data = await response.json();
      if (data.gallery) {
        title = `${data.gallery.title} | ${APP_NAME}`;
        description = data.gallery.description || `Curated gallery by ${address.slice(0, 6)}...${address.slice(-4)}`;
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

export default async function PublicGalleryPage({ params }: PublicGalleryPageProps) {
  const { address, slug } = await params;
  return <PublicGalleryClient curatorAddress={address} slug={slug} />;
}

