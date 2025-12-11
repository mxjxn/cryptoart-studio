import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  APP_BUTTON_TEXT,
  APP_DESCRIPTION,
  APP_NAME,
  APP_OG_IMAGE_URL,
  APP_SPLASH_BACKGROUND_COLOR,
  APP_SPLASH_URL,
  APP_TAGS,
  APP_URL,
} from './constants';
import { manifestConfig } from './farcaster-manifest.config';

// Manifest type definition (from Farcaster miniapp spec)
type AccountAssociation = {
  header: string;
  payload: string;
  signature: string;
};

// Updated Manifest type definition with all optional fields
// According to Farcaster spec, Mini Apps should only include 'miniapp', not 'frame'
// The 'frame' object is for backward compatibility with Frames, not Mini Apps
type Manifest = {
  accountAssociation: AccountAssociation | null;
  // 'frame' is optional - only needed for backward compatibility with Frames
  frame?: {
    version: string;
    name: string;
    homeUrl: string;
    iconUrl: string;
    splashImageUrl: string;
    splashBackgroundColor: string;
    webhookUrl: string;
  };
  miniapp: {
    version: string;
    name: string;
    homeUrl: string;
    iconUrl: string;
    // Deprecated fields (keep for backward compatibility)
    imageUrl?: string;
    buttonTitle?: string;
    splashImageUrl: string;
    splashBackgroundColor: string;
    webhookUrl: string;
    // New recommended fields
    subtitle?: string;
    description?: string;
    screenshotUrls?: string[];
    primaryCategory?: string;
    tags?: string[];
    heroImageUrl?: string;
    tagline?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImageUrl?: string;
    requiredChains?: string[];
    requiredCapabilities?: string[];
    canonicalDomain?: string;
    noindex?: boolean;
  };
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number with commas for thousands separators
 * Example: 5000000 -> "5,000,000"
 */
export function formatNumberWithCommas(num: number | string | bigint): string {
  const numStr = typeof num === 'bigint' ? num.toString() : String(num);
  
  // Split into whole and fractional parts
  const parts = numStr.split('.');
  const wholePart = parts[0];
  const fractionalPart = parts[1] || '';
  
  // Add commas to whole part
  const formattedWhole = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Return with fractional part if it exists
  return fractionalPart ? `${formattedWhole}.${fractionalPart}` : formattedWhole;
}

/**
 * Get BaseScan URL for a transaction hash
 */
export function getBaseScanUrl(hash: string): string {
  return `https://basescan.org/tx/${hash}`;
}

/**
 * Normalize URL by ensuring no double slashes
 * Removes trailing slash from base and ensures path starts with /
 */
export function normalizeUrl(base: string, path: string): string {
  const baseTrimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  const pathTrimmed = path.startsWith('/') ? path : `/${path}`;
  return `${baseTrimmed}${pathTrimmed}`;
}

/**
 * Wrap a promise with a timeout
 * Returns the fallback value if the promise doesn't resolve within the timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

/**
 * Get Mini App embed metadata for Farcaster feeds
 * Follows Farcaster Mini App Embed specification
 * See: https://miniapps.farcaster.xyz/docs/guides/sharing
 * 
 * @param ogImageUrl - URL of the OpenGraph image (should be 3:2 aspect ratio)
 * @param actionUrl - URL where the button should navigate (defaults to current page)
 * @param useFrameType - If true, use "launch_frame" for backward compatibility (fc:frame tag)
 * @param splashImageUrl - URL of splash screen image (defaults to ogImageUrl for auction-specific splash)
 * @param buttonText - Optional custom button text (defaults to APP_BUTTON_TEXT)
 */
export function getMiniAppEmbedMetadata(
  ogImageUrl?: string,
  actionUrl?: string,
  useFrameType: boolean = false,
  splashImageUrl?: string,
  buttonText?: string
) {
  // Use custom button text if provided, otherwise use default
  const buttonTitleText = buttonText || APP_BUTTON_TEXT;
  // Ensure button title doesn't exceed 32 characters
  const buttonTitle = buttonTitleText.length > 32
    ? buttonTitleText.slice(0, 29) + '...'
    : buttonTitleText;

  // Use ogImageUrl as splash screen if not provided (auction-specific splash)
  const finalSplashUrl = splashImageUrl ?? ogImageUrl ?? APP_SPLASH_URL;

  return {
    version: "1", // Must be string literal "1", not "next"
    imageUrl: ogImageUrl ?? APP_OG_IMAGE_URL,
    button: {
      title: buttonTitle, // Max 32 characters
      action: {
        type: useFrameType ? "launch_frame" : "launch_miniapp",
        name: APP_NAME, // Optional, defaults to name in farcaster.json
        url: actionUrl ?? APP_URL, // Optional, defaults to current page URL
        splashImageUrl: finalSplashUrl, // Use auction-specific OG image as splash
        splashBackgroundColor: APP_SPLASH_BACKGROUND_COLOR, // Optional
      },
    },
  };
}

/**
 * Get Farcaster domain manifest for /.well-known/farcaster.json
 * This manifest is used by Farcaster clients to identify and configure the Mini App
 * See: https://miniapps.farcaster.xyz/docs/guides/publishing
 * 
 * The manifest is built from farcaster-manifest.config.ts. Edit that file to modify the manifest.
 */
export async function getFarcasterDomainManifest(): Promise<Manifest> {
  // Format tags: lowercase, no spaces, max 20 chars each, max 5 tags
  const formattedTags = APP_TAGS
    .map(tag => tag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 20))
    .filter(tag => tag.length > 0)
    .slice(0, 5);

  // Extract domain from APP_URL (remove protocol and path)
  const canonicalDomain = APP_URL.replace(/^https?:\/\//, '').split('/')[0];

  // Truncate description to max 170 chars (for description field)
  const truncatedDescription = APP_DESCRIPTION.length > 170
    ? APP_DESCRIPTION.slice(0, 167) + '...'
    : APP_DESCRIPTION;

  // Truncate OG description to max 100 chars
  const ogDescription = APP_DESCRIPTION.length > 100
    ? APP_DESCRIPTION.slice(0, 97) + '...'
    : APP_DESCRIPTION;

  // Build miniapp config from manifest config
  const miniappConfig: Manifest['miniapp'] = {
    ...manifestConfig.miniapp,
    // Ensure required fields are present (Manifest type requires these)
    splashImageUrl: manifestConfig.miniapp.splashImageUrl ?? APP_SPLASH_URL,
    splashBackgroundColor: manifestConfig.miniapp.splashBackgroundColor ?? APP_SPLASH_BACKGROUND_COLOR,
    webhookUrl: manifestConfig.miniapp.webhookUrl ?? `${APP_URL}/api/webhook`,
    // Override with formatted/truncated values
    description: truncatedDescription,
    ogDescription: ogDescription,
    tags: formattedTags.length > 0 ? formattedTags : undefined,
    canonicalDomain: canonicalDomain,
  };
  
  // Remove empty screenshotUrls array (should be omitted if empty)
  if (Array.isArray(miniappConfig.screenshotUrls) && miniappConfig.screenshotUrls.length === 0) {
    delete miniappConfig.screenshotUrls;
  }
  
  // Remove undefined optional fields to keep manifest clean
  (Object.keys(miniappConfig) as Array<keyof typeof miniappConfig>).forEach(key => {
    if (miniappConfig[key] === undefined) {
      delete miniappConfig[key];
    }
  });

  return {
    accountAssociation: manifestConfig.accountAssociation ?? null,
    miniapp: miniappConfig,
  };
}

