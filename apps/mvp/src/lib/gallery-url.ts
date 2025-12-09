/**
 * Helper function to generate gallery URLs
 * Uses the new structure: /user/[username]/gallery/[slug] or /user/[username]/gallery/id/[uuid]
 * Falls back to old structure if username not available
 */
export function getGalleryUrl(
  gallery: { slug?: string | null; id: string; curatorAddress: string },
  username?: string | null
): string {
  if (username) {
    if (gallery.slug) {
      return `/user/${username}/gallery/${gallery.slug}`;
    } else {
      return `/user/${username}/gallery/id/${gallery.id}`;
    }
  }
  // Fallback to old structure if no username
  if (gallery.slug) {
    return `/gallery/${gallery.curatorAddress}/${gallery.slug}`;
  }
  return `/curate/${gallery.id}`;
}

