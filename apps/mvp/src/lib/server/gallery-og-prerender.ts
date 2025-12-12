/**
 * Pre-render OG images for galleries
 * This generates and caches OG images when artworks are added to galleries
 * Since gallery metadata changes when items are added, we pre-render after updates
 */

/**
 * Pre-render OG image for a gallery
 * This triggers the OG image generation endpoint which will cache the result
 * 
 * @param username - The username of the gallery curator
 * @param slug - The gallery slug
 * @param baseUrl - Base URL of the application (for generating the OG image URL)
 * @returns Promise that resolves when pre-rendering is complete (or fails silently)
 */
export async function prerenderGalleryOGImage(
  username: string,
  slug: string,
  baseUrl?: string
): Promise<void> {
  try {
    // Get the base URL from environment or parameter
    const url = baseUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    
    // Construct the OG image URL
    const ogImageUrl = `${url}/user/${encodeURIComponent(username)}/gallery/${encodeURIComponent(slug)}/opengraph-image`;
    
    console.log(`[Gallery OG Prerender] Pre-rendering OG image for gallery @${username}/${slug}...`);
    
    // Fetch the OG image endpoint to trigger generation and caching
    // Use a longer timeout since we're processing multiple artworks
    const response = await fetch(ogImageUrl, {
      headers: {
        'User-Agent': 'CryptoArt-Prerender/1.0',
      },
      signal: AbortSignal.timeout(45000), // 45 second timeout for multiple artworks
    });
    
    if (!response.ok) {
      console.warn(
        `[Gallery OG Prerender] Failed to pre-render OG image for gallery @${username}/${slug}: ${response.status} ${response.statusText}`
      );
      return;
    }
    
    // Read the response to ensure it's fully generated (even though we don't use it)
    await response.arrayBuffer();
    
    console.log(`[Gallery OG Prerender] Successfully pre-render OG image for gallery @${username}/${slug}`);
  } catch (error) {
    // Don't throw - pre-rendering is optional and shouldn't block gallery updates
    console.warn(
      `[Gallery OG Prerender] Error pre-rendering OG image for gallery @${username}/${slug}:`,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Pre-render OG image for a gallery by gallery ID
 * Looks up the gallery to get username and slug, then pre-renders
 * 
 * @param galleryId - The gallery ID
 * @param baseUrl - Base URL of the application
 */
export async function prerenderGalleryOGImageById(
  galleryId: string,
  baseUrl?: string
): Promise<void> {
  try {
    const url = baseUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    
    // Fetch gallery data to get username and slug
    const response = await fetch(`${url}/api/curation/${galleryId}`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      console.warn(
        `[Gallery OG Prerender] Failed to fetch gallery ${galleryId} for pre-render: ${response.status}`
      );
      return;
    }
    
    const data = await response.json();
    if (!data.gallery) {
      console.warn(`[Gallery OG Prerender] Gallery ${galleryId} not found`);
      return;
    }
    
    // Get username from curator address (we'd need to look this up)
    // For now, we'll need the username passed in or fetched separately
    // This is a limitation - we may need to store username in the gallery or fetch it
    console.warn(`[Gallery OG Prerender] Cannot pre-render by ID without username. Use prerenderGalleryOGImage with username and slug instead.`);
  } catch (error) {
    console.warn(
      `[Gallery OG Prerender] Error fetching gallery ${galleryId} for pre-render:`,
      error instanceof Error ? error.message : String(error)
    );
  }
}
