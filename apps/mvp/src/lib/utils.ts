import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  APP_BUTTON_TEXT,
  APP_DESCRIPTION,
  APP_ICON_URL,
  APP_NAME,
  APP_OG_IMAGE_URL,
  APP_PRIMARY_CATEGORY,
  APP_SPLASH_BACKGROUND_COLOR,
  APP_SPLASH_URL,
  APP_TAGS,
  APP_URL,
  APP_WEBHOOK_URL,
  APP_ACCOUNT_ASSOCIATION,
} from './constants';

// Manifest type definition (from Farcaster miniapp spec)
type AccountAssociation = {
  header: string;
  payload: string;
  signature: string;
};

type Manifest = {
  accountAssociation: AccountAssociation | null;
  miniapp: {
    version: string;
    name: string;
    homeUrl: string;
    iconUrl: string;
    imageUrl: string;
    buttonTitle: string;
    splashImageUrl: string;
    splashBackgroundColor: string;
    webhookUrl: string;
  };
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
 * Get Mini App embed metadata for Farcaster feeds
 * Follows Farcaster Mini App Embed specification
 * See: https://miniapps.farcaster.xyz/docs/guides/sharing
 * 
 * @param ogImageUrl - URL of the OpenGraph image (should be 3:2 aspect ratio)
 * @param actionUrl - URL where the button should navigate (defaults to current page)
 * @param useFrameType - If true, use "launch_frame" for backward compatibility (fc:frame tag)
 * @param splashImageUrl - URL of splash screen image (defaults to ogImageUrl for auction-specific splash)
 */
export function getMiniAppEmbedMetadata(
  ogImageUrl?: string,
  actionUrl?: string,
  useFrameType: boolean = false,
  splashImageUrl?: string
) {
  // Ensure button title doesn't exceed 32 characters
  const buttonTitle = APP_BUTTON_TEXT.length > 32
    ? APP_BUTTON_TEXT.slice(0, 29) + '...'
    : APP_BUTTON_TEXT;

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
 * See: https://miniapps.farcaster.xyz/docs/guides/manifest
 */
export async function getFarcasterDomainManifest(): Promise<Manifest> {
  return {
    accountAssociation: APP_ACCOUNT_ASSOCIATION ?? null,
    miniapp: {
      version: '1',
      name: APP_NAME,
      homeUrl: APP_URL,
      iconUrl: APP_ICON_URL,
      imageUrl: APP_OG_IMAGE_URL,
      buttonTitle: APP_BUTTON_TEXT,
      splashImageUrl: APP_SPLASH_URL,
      splashBackgroundColor: APP_SPLASH_BACKGROUND_COLOR,
      webhookUrl: APP_WEBHOOK_URL,
    },
  };
}

