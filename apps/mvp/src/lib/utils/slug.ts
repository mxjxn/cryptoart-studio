/**
 * Convert a string to a URL-friendly slug
 */
export function generateSlug(title: string): string {
  // Convert to lowercase and replace unwanted characters and spaces with hyphens
  let result = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  // Remove leading or trailing hyphens
  result = result.replace(/^-|-$/g, "");
  // Limit to reasonable length (50 chars)
  if (result.length > 50) {
    result = result.slice(0, 50);
    // Remove trailing hyphen if we cut off mid-word
    result = result.replace(/-$/, "");
  }
  return result;
}

