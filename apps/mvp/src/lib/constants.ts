/**
 * Application constants and configuration values.
 */

// Account association type (from Farcaster miniapp spec)
type AccountAssociation = {
  header: string;
  payload: string;
  signature: string;
};

// --- App Configuration ---
// Normalize APP_URL to remove trailing slash to prevent double slashes
const getBaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

export const APP_URL: string = getBaseUrl();

export const APP_NAME: string = 'Cryptoart';

export const APP_DESCRIPTION: string = 'Create NFT auctions, place bids, and collect digital art. A multi-modal marketplace for artists and collectors on Farcaster.';

export const APP_PRIMARY_CATEGORY: string = 'art-creativity';

export const APP_TAGS: string[] = ['nft', 'auction', 'art', 'cryptoart', 'marketplace', 'artists', 'collectors', 'curation'];

// --- Asset URLs ---
export const APP_ICON_URL: string = `${APP_URL}/icon.png`;

export const APP_OG_IMAGE_URL: string = `${APP_URL}/opengraph-image`;

export const APP_SPLASH_URL: string = `${APP_URL}/splash.png`;

export const APP_SPLASH_BACKGROUND_COLOR: string = '#f7f7f7';

export const APP_ACCOUNT_ASSOCIATION: AccountAssociation | undefined = {
  header: "eyJmaWQiOjQ5MDUsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgwRTQzYTJBQ2IyRkIzZDlCYWE1MjIyYjE4M2UwNDMyYkVlMmM2NUFCIn0",
  payload: "eyJkb21haW4iOiJjcnlwdG9hcnQuc29jaWFsIn0",
  signature: "IkPegubbCMgyek/MWXcv2KFFI5Wq6jUQFocWpBCh3V5mKbbKFvNuwrUBHTWoySM0atW0WglNvfUBmMr1tNj3zhw="
};

// --- UI Configuration ---
export const APP_BUTTON_TEXT: string = 'Browse Auctions';

// --- Integration Configuration ---
export const APP_WEBHOOK_URL: string =
  process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID
    ? `https://api.neynar.com/f/app/${process.env.NEYNAR_CLIENT_ID}/event`
    : `${APP_URL}/api/webhook`;

export const ANALYTICS_ENABLED: boolean = true;

export const RETURN_URL: string | undefined = undefined;

// --- Membership Configuration ---
export const STP_V2_CONTRACT_ADDRESS = '0x4b212e795b74a36B4CCf744Fc2272B34eC2e9d90' as const;

// --- Admin Configuration ---
// Hardcoded admin identity for platform moderation
export const ADMIN_CONFIG = {
  // Primary admin wallet address (lowercase) - TODO: Update with full address
  walletAddress: '0x6dA0a1784De1aBDDe1734bA37eCa3d560bf044c0'.toLowerCase() as `0x${string}`,
   
  // Primary admin Farcaster username
  farcasterUsername: 'mxjxn',
  
  // Primary admin FID - TODO: Verify actual FID
  fid: 4905,
} as const;

// PLEASE DO NOT UPDATE THIS
export const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
  name: 'Farcaster SignedKeyRequestValidator',
  version: '1',
  chainId: 10,
  verifyingContract:
    '0x00000000fc700472606ed4fa22623acf62c60553' as `0x${string}`,
};

export const SIGNED_KEY_REQUEST_TYPE = [
  { name: 'requestFid', type: 'uint256' },
  { name: 'key', type: 'bytes' },
  { name: 'deadline', type: 'uint256' },
];

// --- Manifest Metadata ---
export const APP_SUBTITLE: string = 'NFT marketplace & auctions';

export const APP_TAGLINE: string = 'Auctionhouse & Marketplace';

// Screenshot URLs (add when you create portrait screenshots)
// Format: 1284x2778px portrait images, max 3
export const APP_SCREENSHOT_URLS: string[] = [
  // `${APP_URL}/screenshots/screenshot1.png`,
  // `${APP_URL}/screenshots/screenshot2.png`,
  // `${APP_URL}/screenshots/screenshot3.png`,
];

