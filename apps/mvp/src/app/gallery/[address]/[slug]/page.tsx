import { redirect } from "next/navigation";

interface PublicGalleryPageProps {
  params: Promise<{ address: string; slug: string }>;
}

/**
 * Redirect old gallery URLs to new structure: /user/[username]/gallery/[slug]
 * The API endpoint handles both usernames and addresses, so we can redirect directly
 */
export default async function PublicGalleryPage({ params }: PublicGalleryPageProps) {
  const { address, slug } = await params;
  
  // Redirect to new structure - API will handle address or username resolution
  redirect(`/user/${address}/gallery/${slug}`);
}

