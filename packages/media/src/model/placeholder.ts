export function buildModelCoverPlaceholderSvg(title: string, creator?: string): string {
  const safeTitle = escapeXml(title || '3D work');
  const safeCreator = creator ? escapeXml(creator) : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1c1c1f"/>
      <stop offset="100%" stop-color="#0b0b0d"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#g)"/>
  <path d="M400 220 L560 420 L400 580 L240 420 Z" fill="none" stroke="#8b8b93" stroke-width="4"/>
  <text x="400" y="640" text-anchor="middle" fill="#e8e8ec" font-family="system-ui,sans-serif" font-size="32" font-weight="600">${safeTitle}</text>
  ${safeCreator ? `<text x="400" y="682" text-anchor="middle" fill="#9a9aa3" font-family="system-ui,sans-serif" font-size="22">${safeCreator}</text>` : ''}
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