/**
 * Helper function to generate gallery URLs
 * Uses the new structure: /user/[username]/gallery/[slug]
 * Falls back to old structure if username not available
 */
export function getGalleryUrl(
  gallery: { slug?: string | null; id: string; curatorAddress: string },
  username?: string | null
): string {
  if (gallery.slug && username) {
    return `/user/${username}/gallery/${gallery.slug}`;
  }
  // Fallback to old structure if no slug or username
  if (gallery.slug) {
    return `/gallery/${gallery.curatorAddress}/${gallery.slug}`;
  }
  return `/curate/${gallery.id}`;
}

