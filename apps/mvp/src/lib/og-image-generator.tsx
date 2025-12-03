import type { EnrichedAuctionData } from "~/lib/types";
import { getContractNameServer } from "~/lib/server/contract-name";
import { getArtistNameServer } from "~/lib/server/artist-name";
import { getERC20TokenInfoServer } from "~/lib/server/erc20-token";

/**
 * Convert IPFS URL to HTTP gateway URL
 * Tries multiple gateways for better reliability
 */
function ipfsToGateway(url: string): string {
  const gateways = [
    process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://cloudflare-ipfs.com",
    "https://ipfs.io",
    "https://gateway.pinata.cloud",
  ];
  
  if (url.startsWith("ipfs://")) {
    const hash = url.replace("ipfs://", "");
    return `${gateways[0]}/ipfs/${hash}`;
  }
  if (url.startsWith("ipfs/")) {
    return `${gateways[0]}/${url}`;
  }
  return url;
}

/**
 * Fetch image and convert to data URL for use in ImageResponse
 * Tries multiple IPFS gateways if the first fails
 */
async function fetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  const gateways = [
    process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://cloudflare-ipfs.com",
    "https://ipfs.io",
    "https://gateway.pinata.cloud",
  ];
  
  // Check if it's an IPFS URL and try multiple gateways
  let urlsToTry = [imageUrl];
  if (imageUrl.includes('/ipfs/')) {
    const ipfsHash = imageUrl.split('/ipfs/')[1];
    urlsToTry = gateways.map(gw => `${gw}/ipfs/${ipfsHash}`);
  }
  
  for (const url of urlsToTry) {
    try {
      console.log(`[OG Image] [fetchImageAsDataUrl] Trying to fetch image from: ${url.substring(0, 100)}...`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Bot/1.0)',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (!response.ok) {
        console.warn(`[OG Image] [fetchImageAsDataUrl] Gateway returned ${response.status} ${response.statusText}, trying next...`);
        continue;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const contentType = response.headers.get('content-type') || 'image/png';
      const dataUrl = `data:${contentType};base64,${base64}`;
      
      console.log(`[OG Image] [fetchImageAsDataUrl] Image fetched successfully from ${url.substring(0, 50)}..., size: ${buffer.length} bytes, type: ${contentType}`);
      return dataUrl;
    } catch (error) {
      console.warn(`[OG Image] [fetchImageAsDataUrl] Error fetching from ${url.substring(0, 50)}...:`, error instanceof Error ? error.message : String(error));
      continue;
    }
  }
  
  console.error(`[OG Image] [fetchImageAsDataUrl] All gateways failed for image`);
  return null;
}

/**
 * Format time remaining until auction ends
 */
function formatTimeRemaining(endTime: number): string {
  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = endTime > now ? endTime - now : 0;

  if (timeRemaining <= 0) {
    return "Ended";
  }

  const days = Math.floor(timeRemaining / 86400);
  const hours = Math.floor((timeRemaining % 86400) / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Truncate text to fit within a maximum length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Prepare data for OpenGraph image generation
 */
export async function prepareAuctionOGImageData(auction: EnrichedAuctionData) {
  const startTime = Date.now();
  console.log(`[OG Image] [prepareAuctionOGImageData] Starting data preparation for auction ${auction.listingId}`);
  
  // Fetch contract name, artist name, and ERC20 token info
  console.log(`[OG Image] [prepareAuctionOGImageData] Fetching contract name, artist name, and ERC20 token info...`);
  const [contractName, artistResult, tokenInfo] = await Promise.all([
    auction.tokenAddress
      ? getContractNameServer(auction.tokenAddress)
      : Promise.resolve(null),
    auction.tokenAddress
      ? getArtistNameServer(
          auction.tokenAddress,
          auction.tokenId ? BigInt(auction.tokenId) : undefined
        )
      : Promise.resolve({ name: null, source: null }),
    getERC20TokenInfoServer(auction.erc20),
  ]);
  
  console.log(`[OG Image] [prepareAuctionOGImageData] Contract name: ${contractName || 'null'}`);
  console.log(`[OG Image] [prepareAuctionOGImageData] Artist name: ${artistResult.name || 'null'} (source: ${artistResult.source || 'null'})`);
  console.log(`[OG Image] [prepareAuctionOGImageData] ERC20 token: ${tokenInfo.symbol || 'ETH'} (${tokenInfo.decimals} decimals)`);

  // Prepare text content
  const title = truncate(
    auction.title || auction.metadata?.title || `Auction #${auction.listingId}`,
    50
  );
  const collectionName = contractName ? truncate(contractName, 30) : null;
  const artistName = artistResult.name ? truncate(artistResult.name, 30) : null;

  // Calculate pricing
  const currentPrice =
    auction.highestBid?.amount || auction.initialAmount || "0";
  const reservePrice = auction.initialAmount || "0";
  const displayPrice =
    BigInt(currentPrice) > BigInt(reservePrice) ? currentPrice : reservePrice;
  const priceLabel =
    BigInt(currentPrice) > BigInt(reservePrice) ? "Current Bid" : "Reserve";

  // Format price using the correct token decimals
  const formatPrice = (amount: string, decimals: number): string => {
    const value = BigInt(amount || "0");
    const divisor = BigInt(10 ** decimals);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;
    
    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }
    
    let fractionalStr = fractionalPart.toString().padStart(decimals, "0");
    fractionalStr = fractionalStr.replace(/0+$/, "");
    if (fractionalStr.length > 6) {
      fractionalStr = fractionalStr.slice(0, 6);
    }
    
    return `${wholePart}.${fractionalStr}`;
  };

  const formattedPrice = formatPrice(displayPrice, tokenInfo.decimals);
  const priceSymbol = tokenInfo.symbol || "ETH";

  // Format end time
  const endTime = parseInt(auction.endTime || "0");
  const timeText = formatTimeRemaining(endTime);

  // Get NFT image URL - convert IPFS to gateway URL
  // Note: Next.js ImageResponse can fetch external URLs automatically
  let imageUrl = auction.image || auction.metadata?.image || null;
  if (imageUrl) {
    const originalUrl = imageUrl;
    imageUrl = ipfsToGateway(imageUrl);
    if (originalUrl !== imageUrl) {
      console.log(`[OG Image] [prepareAuctionOGImageData] Converted IPFS URL: ${originalUrl.substring(0, 50)}... -> ${imageUrl.substring(0, 50)}...`);
    }
  } else {
    console.warn(`[OG Image] [prepareAuctionOGImageData] No NFT image URL found`);
  }

  const elapsed = Date.now() - startTime;
  console.log(`[OG Image] [prepareAuctionOGImageData] Data preparation complete in ${elapsed}ms`);
  
  return {
    title,
    collectionName,
    artistName,
    priceLabel,
    price: formattedPrice,
    priceSymbol,
    timeText,
    imageUrl, // Pass URL directly - ImageResponse will fetch it
    listingId: auction.listingId,
  };
}

/**
 * Generate the JSX structure for the OpenGraph image
 * Compatible with Next.js ImageResponse (uses style objects, not className)
 */
export function getAuctionOGImageJSX(data: {
  title: string;
  collectionName: string | null;
  artistName: string | null;
  priceLabel: string;
  price: string;
  priceSymbol: string;
  timeText: string;
  imageUrl: string | null;
  listingId: string;
}) {
  const {
    title,
    collectionName,
    artistName,
    priceLabel,
    price,
    priceSymbol,
    timeText,
    imageUrl,
  } = data;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "black",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "80px",
        justifyContent: "center",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: "72px",
          fontWeight: "bold",
          lineHeight: "1.2",
          marginBottom: "40px",
          color: "white",
        }}
      >
        {title}
      </div>

      {/* Collection Name */}
      <div
        style={{
          fontSize: "32px",
          color: "rgba(255, 255, 255, 0.8)",
          marginBottom: "20px",
          display: collectionName ? "block" : "none",
        }}
      >
        {collectionName || ""}
      </div>

      {/* Artist Name */}
      <div
        style={{
          fontSize: "40px",
          color: "rgba(255, 255, 255, 0.9)",
          marginBottom: "60px",
          display: artistName ? "block" : "none",
        }}
      >
        {artistName ? `by ${artistName}` : ""}
      </div>

      {/* Price */}
      <div
        style={{
          fontSize: "48px",
          fontWeight: "600",
          marginBottom: "30px",
          color: "white",
        }}
      >
        {priceLabel}: {price} {priceSymbol}
      </div>

      {/* End Time */}
      <div
        style={{
          fontSize: "32px",
          color: "rgba(255, 255, 255, 0.85)",
        }}
      >
        {timeText}
      </div>
    </div>
  );
}

