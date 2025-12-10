/**
 * Helper function to generate gallery URLs
 * Uses the new structure: /user/[username]/gallery/[slug] or /user/[username]/gallery/[index]
 * Falls back to old structure if username not available
 */
export function getGalleryUrl(
  gallery: { slug?: string | null; id: string; curatorAddress: string },
  username?: string | null,
  galleryIndex?: number | null
): string {
  if (username) {
    if (gallery.slug) {
      return `/user/${username}/gallery/${gallery.slug}`;
    } else if (galleryIndex !== undefined && galleryIndex !== null) {
      // Default to gallery index when no slug exists
      return `/user/${username}/gallery/${galleryIndex}`;
    } else {
      // Fallback to UUID if no index provided (for backwards compatibility)
      return `/user/${username}/gallery/id/${gallery.id}`;
    }
  }
  // Fallback to old structure if no username
  if (gallery.slug) {
    return `/gallery/${gallery.curatorAddress}/${gallery.slug}`;
  }
  return `/curate/${gallery.id}`;
}

