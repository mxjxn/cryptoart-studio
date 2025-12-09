/**
 * Utility functions for working with thumbnails in components
 */

/**
 * Get thumbnail URL for an NFT image
 * 
 * Usage in components:
 * ```tsx
 * const thumbnailUrl = await getThumbnailUrl(metadata.image, 'medium');
 * <img src={thumbnailUrl} alt={metadata.name} />
 * ```
 * 
 * Or in client components:
 * ```tsx
 * const { data } = useQuery({
 *   queryKey: ['thumbnail', imageUrl, 'medium'],
 *   queryFn: () => fetch(`/api/thumbnails?imageUrl=${encodeURIComponent(imageUrl)}&size=medium`)
 *     .then(r => r.json())
 *     .then(d => d.thumbnailUrl)
 * });
 * ```
 */
export async function getThumbnailUrl(
  imageUrl: string | null | undefined,
  size: 'small' | 'medium' | 'large' = 'medium'
): Promise<string | null> {
  if (!imageUrl) {
    return null;
  }

  try {
    const response = await fetch(
      `/api/thumbnails?imageUrl=${encodeURIComponent(imageUrl)}&size=${size}`
    );
    
    if (!response.ok) {
      console.warn(`Failed to get thumbnail for ${imageUrl}`);
      return imageUrl; // Fallback to original
    }
    
    const data = await response.json();
    return data.thumbnailUrl || imageUrl;
  } catch (error) {
    console.warn(`Error getting thumbnail:`, error);
    return imageUrl; // Fallback to original
  }
}

/**
 * Get thumbnail URL synchronously (for server components)
 * This will check cache first, but may need to generate if not cached
 */
export async function getThumbnailUrlSync(
  imageUrl: string | null | undefined,
  size: 'small' | 'medium' | 'large' = 'medium'
): Promise<string | null> {
  if (!imageUrl) {
    return null;
  }

  const { getOrGenerateThumbnail } = await import('./server/thumbnail-generator');
  
  try {
    return await getOrGenerateThumbnail(imageUrl, size);
  } catch (error) {
    console.warn(`Error generating thumbnail:`, error);
    return imageUrl; // Fallback to original
  }
}




