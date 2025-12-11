/**
 * Farcaster Mini App Manifest Configuration
 * 
 * Reference: https://miniapps.farcaster.xyz/docs/guides/publishing
 * 
 * This file contains the manifest configuration for your Farcaster Mini App.
 * Edit the values below to customize your manifest. Values from constants.ts
 * are imported directly - edit constants.ts to change those values.
 * 
 * IMPORTANT: 
 * - Required fields must be set (cannot be null/undefined)
 * - Optional fields should be omitted entirely if not needed (don't set to null or empty arrays)
 * - Character limits and format requirements are enforced at runtime
 */

import {
  APP_BUTTON_TEXT,
  APP_DESCRIPTION,
  APP_ICON_URL,
  APP_NAME,
  APP_OG_IMAGE_URL,
  APP_SPLASH_BACKGROUND_COLOR,
  APP_SPLASH_URL,
  APP_SUBTITLE,
  APP_TAGLINE,
  APP_TAGS,
  APP_URL,
  APP_WEBHOOK_URL,
  APP_ACCOUNT_ASSOCIATION,
} from './constants';

export interface ManifestConfig {
  miniapp: {
    // REQUIRED FIELDS
    version: string; // Must be "1" (string, not number)
    name: string; // Max 32 characters
    homeUrl: string; // Max 1024 characters
    iconUrl: string; // Max 1024 characters, 1024x1024px PNG, no alpha
    
    // DEPRECATED FIELDS (kept for backward compatibility)
    imageUrl?: string; // DEPRECATED - Max 1024 chars, 3:2 aspect ratio
    buttonTitle?: string; // DEPRECATED - Max 32 characters
    
    // SPLASH SCREEN
    splashImageUrl?: string; // Must be 200x200px, max 32 characters
    splashBackgroundColor?: string; // Hex color code (e.g., "#000000")
    
    // WEBHOOK
    webhookUrl?: string; // Required if app uses notifications. Max 1024 chars
    // IMPORTANT: Make sure NEYNAR_CLIENT_ID is set in env vars for production webhook
    
    // DISCOVERY & METADATA
    subtitle?: string; // Max 30 chars, no emojis or special characters
    description?: string; // Max 170 chars, no emojis or special characters (will be truncated)
    screenshotUrls?: string[]; // Up to 3 screenshots, each 1284x2778px portrait. Omit if empty!
    primaryCategory?: string; // One of: games, social, finance, utility, productivity, health-fitness, news-media, music, shopping, education, developer-tools, entertainment, art-creativity
    tags?: string[]; // Up to 5 tags, max 20 chars each. Lowercase, no spaces, no special chars, no emojis (will be formatted from APP_TAGS)
    
    // PROMOTIONAL IMAGES
    heroImageUrl?: string; // 1200x630px (1.91:1 aspect ratio)
    tagline?: string; // Max 30 characters
    
    // OPEN GRAPH METADATA
    ogTitle?: string; // Max 30 characters
    ogDescription?: string; // Max 100 characters (will be truncated)
    ogImageUrl?: string; // 1200x630px (1.91:1) PNG
    
    // TECHNICAL CONFIGURATION
    requiredChains?: string[]; // CAIP-2 IDs (e.g., ["eip155:8453"] for Base)
    requiredCapabilities?: string[]; // SDK method paths (e.g., ["wallet.getEthereumProvider"])
    canonicalDomain?: string; // Domain without protocol/port/path. Max 1024 chars (will be extracted from APP_URL)
    noindex?: boolean; // true = exclude from search, false = include (default)
  };
  
  // ACCOUNT ASSOCIATION (optional - verifies domain ownership)
  // Generate using: https://farcaster.xyz/~/developers/mini-apps/manifest
  accountAssociation?: {
    header: string; // Base64 encoded JFS header
    payload: string; // Base64 encoded payload containing domain
    signature: string; // Base64 encoded signature
  } | null;
}

/**
 * Manifest configuration
 * 
 * Edit the values below to customize your manifest. Values from constants.ts
 * are used directly - edit constants.ts to change those values.
 */
export const manifestConfig: ManifestConfig = {
  miniapp: {
    // REQUIRED FIELDS
    version: '1',
    name: APP_NAME,
    homeUrl: APP_URL,
    iconUrl: APP_ICON_URL,
    
    // DEPRECATED FIELDS (backward compatibility)
    imageUrl: APP_OG_IMAGE_URL,
    buttonTitle: APP_BUTTON_TEXT,
    
    // SPLASH SCREEN
    splashImageUrl: APP_SPLASH_URL,
    splashBackgroundColor: APP_SPLASH_BACKGROUND_COLOR,
    
    // WEBHOOK
    // This uses APP_WEBHOOK_URL from constants.ts, which automatically uses Neynar webhook
    // if NEYNAR_CLIENT_ID is set in environment variables
    webhookUrl: APP_WEBHOOK_URL,
    
    // DISCOVERY & METADATA
    subtitle: APP_SUBTITLE,
    description: APP_DESCRIPTION, // Will be truncated to 170 chars in utils.ts
    // screenshotUrls: [], // Omit this field if you don't have screenshots yet
    primaryCategory: 'art-creativity',
    tags: APP_TAGS, // Will be formatted (lowercase, no spaces, etc.) in utils.ts
    
    // PROMOTIONAL IMAGES
    heroImageUrl: APP_OG_IMAGE_URL,
    tagline: APP_TAGLINE,
    
    // OPEN GRAPH METADATA
    ogTitle: APP_NAME,
    ogDescription: APP_DESCRIPTION, // Will be truncated to 100 chars in utils.ts
    ogImageUrl: APP_OG_IMAGE_URL,
    
    // TECHNICAL CONFIGURATION
    requiredChains: ['eip155:8453'], // Base Mainnet
    requiredCapabilities: [
      'wallet.getEthereumProvider',
      'actions.swapToken',
      'actions.signIn',
    ],
    canonicalDomain: APP_URL, // Will be extracted (domain only) in utils.ts
    noindex: false,
  },
  
  // Account association from constants.ts
  accountAssociation: APP_ACCOUNT_ASSOCIATION ?? null,
};
