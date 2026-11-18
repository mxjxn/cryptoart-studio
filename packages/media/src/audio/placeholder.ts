/** Tiny SVG used when the artist does not supply cover art. */
export function buildAudioCoverPlaceholderSvg(title: string, artist?: string): string {
  const safeTitle = escapeXml(title || 'Untitled');
  const safeArtist = artist ? escapeXml(artist) : '';
  const subtitle = safeArtist ? `<text x="140" y="172" text-anchor="middle" fill="#8a8a8a" font-family="system-ui,sans-serif" font-size="13">${safeArtist}</text>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" viewBox="0 0 280 280" role="img" aria-label="${safeTitle}">
  <rect width="280" height="280" fill="#111"/>
  <circle cx="140" cy="118" r="44" fill="none" stroke="#3a3a3a" stroke-width="2"/>
  <circle cx="140" cy="118" r="8" fill="#e8e8e8"/>
  <path d="M108 118 L180 78 L180 158 Z" fill="#e8e8e8"/>
  <text x="140" y="208" text-anchor="middle" fill="#f0f0f0" font-family="system-ui,sans-serif" font-size="16" font-weight="600">${safeTitle}</text>
  ${subtitle}
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}