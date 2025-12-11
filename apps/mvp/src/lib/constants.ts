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

export const APP_SPLASH_BACKGROUND_COLOR: string = '#000000';

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

// --- Gallery Access NFT Configuration ---
// NFT contract address that gates access to the galleries feature
// Users with balanceOf > 0 in any associated wallet can use galleries
export const GALLERY_ACCESS_NFT_CONTRACT_ADDRESS = '0x96640349f9e87A2FE151d8114Acbc53D6e43CE7A' as const;

// --- Admin Configuration ---
// Admin identity loaded from environment variables for security
// Set ADMIN_WALLET_ADDRESS (or NEXT_PUBLIC_ADMIN_WALLET_ADDRESS for client-side),
// ADMIN_FARCASTER_USERNAME (or NEXT_PUBLIC_ADMIN_FARCASTER_USERNAME), and 
// ADMIN_FID (or NEXT_PUBLIC_ADMIN_FID) in your environment
// Additional admin addresses can be set via ADDITIONAL_ADMIN_ADDRESSES (comma-separated)
// 
// Note: NEXT_PUBLIC_ prefixed vars are available on client-side (required for useIsAdmin hook)
// Non-prefixed vars work on server-side only
export const ADMIN_CONFIG = {
  // Primary admin wallet address (lowercase) - checks NEXT_PUBLIC_ prefix first (client), then server-only var
  walletAddress: (
    process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || 
    process.env.ADMIN_WALLET_ADDRESS || 
    '0x0000000000000000000000000000000000000000'
  ).toLowerCase() as `0x${string}`,
   
  // Primary admin Farcaster username - checks NEXT_PUBLIC_ prefix first (client), then server-only var
  farcasterUsername: process.env.NEXT_PUBLIC_ADMIN_FARCASTER_USERNAME || process.env.ADMIN_FARCASTER_USERNAME || '',
  
  // Primary admin FID - checks NEXT_PUBLIC_ prefix first (client), then server-only var
  fid: parseInt(
    process.env.NEXT_PUBLIC_ADMIN_FID || 
    process.env.ADMIN_FID || 
    '0', 
    10
  ),
} as const;

// Parse additional admin addresses from comma-separated env var
// Format: ADDITIONAL_ADMIN_ADDRESSES=0xAddress1,0xAddress2,0xAddress3
// Note: For client-side access, use NEXT_PUBLIC_ADDITIONAL_ADMIN_ADDRESSES
const parseAdditionalAdminAddresses = (): `0x${string}`[] => {
  // Check NEXT_PUBLIC_ prefix first (for client-side), then fall back to server-only var
  const envValue = process.env.NEXT_PUBLIC_ADDITIONAL_ADMIN_ADDRESSES || process.env.ADDITIONAL_ADMIN_ADDRESSES;
  if (!envValue) return [];
  
  return envValue
    .split(',')
    .map(addr => addr.trim().toLowerCase())
    .filter(addr => addr.startsWith('0x') && addr.length === 42) // Basic validation
    .map(addr => addr as `0x${string}`);
};

// All admin addresses (primary + additional)
export const ALL_ADMIN_ADDRESSES: readonly `0x${string}`[] = [
  ADMIN_CONFIG.walletAddress,
  ...parseAdditionalAdminAddresses(),
].filter(addr => addr !== '0x0000000000000000000000000000000000000000') as readonly `0x${string}`[];

// Runtime verification helper (for debugging) - only log once per session
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const debugKey = 'admin-config-debug-logged';
  if (!sessionStorage.getItem(debugKey)) {
    sessionStorage.setItem(debugKey, 'true');
    console.log('[Admin Config] Loaded values:', {
      walletAddress: ADMIN_CONFIG.walletAddress,
      farcasterUsername: ADMIN_CONFIG.farcasterUsername,
      fid: ADMIN_CONFIG.fid,
      allAdminAddresses: ALL_ADMIN_ADDRESSES,
      envVars: {
        NEXT_PUBLIC_ADMIN_WALLET_ADDRESS: process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS,
        NEXT_PUBLIC_ADMIN_FID: process.env.NEXT_PUBLIC_ADMIN_FID,
        NEXT_PUBLIC_ADMIN_FARCASTER_USERNAME: process.env.NEXT_PUBLIC_ADMIN_FARCASTER_USERNAME,
      },
    });
  }
}

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
export const APP_SUBTITLE: string = 'NFT marketplace and auctions';

export const APP_TAGLINE: string = 'Auctionhouse and Marketplace';

// Screenshot URLs (add when you create portrait screenshots)
// Format: 1284x2778px portrait images, max 3
export const APP_SCREENSHOT_URLS: string[] = [
  // `${APP_URL}/screenshots/screenshot1.png`,
  // `${APP_URL}/screenshots/screenshot2.png`,
  // `${APP_URL}/screenshots/screenshot3.png`,
];

