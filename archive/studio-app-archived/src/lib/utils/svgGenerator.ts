/**
 * Generates an SVG data URI for an NFT
 * @param collectionName - The name of the collection
 * @param tokenNumber - The token number/ID
 * @returns SVG data URI string
 */
export function generateNFTImageSVG(collectionName: string, tokenNumber: number): string {
  const svg = `
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="url(#grad)"/>
      <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" 
            font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white">
        ${escapeXml(collectionName)}
      </text>
      <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" 
            font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white">
        #${tokenNumber}
      </text>
    </svg>
  `.trim();

  const encodedSvg = encodeURIComponent(svg);
  return `data:image/svg+xml,${encodedSvg}`;
}

/**
 * Escapes XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates a token URI (JSON metadata) for an NFT with SVG data URI
 */
export function generateTokenURI(collectionName: string, tokenNumber: number): string {
  const imageUri = generateNFTImageSVG(collectionName, tokenNumber);
  const metadata = {
    name: `${collectionName} #${tokenNumber}`,
    description: `Token #${tokenNumber} from ${collectionName} collection`,
    image: imageUri,
    attributes: [
      {
        trait_type: "Token Number",
        value: tokenNumber.toString(),
      },
    ],
  };

  const json = JSON.stringify(metadata);
  const encodedJson = encodeURIComponent(json);
  return `data:application/json,${encodedJson}`;
}

